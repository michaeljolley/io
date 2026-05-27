import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface Task {
  id: string;
  squad_id: string;
  instance_id: string | null;
  agent_id: string | null;
  description: string;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export function createTask(
  squadId: string,
  description: string,
  instanceId?: string,
  agentId?: string
): Task {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, squad_id, instance_id, agent_id, description, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(id, squadId, instanceId ?? null, agentId ?? null, description);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function getTasksForSquad(squadId: string): Task[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM tasks WHERE squad_id = ? ORDER BY created_at DESC")
    .all(squadId) as Task[];
}

export function updateTaskStatus(
  taskId: string,
  status: string,
  result?: string
): void {
  const db = getDb();
  if (result !== undefined) {
    db.prepare(
      "UPDATE tasks SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, result, taskId);
  } else {
    db.prepare(
      "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, taskId);
  }
}

export function getTask(taskId: string): Task | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Task | undefined;
}

export function getActiveTasksForInstance(instanceId: string): Task[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM tasks WHERE instance_id = ? AND status NOT IN ('done', 'failed') ORDER BY created_at"
    )
    .all(instanceId) as Task[];
}

export interface SquadTaskMetrics {
  squadId: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksCompletedRecent: number;
  tasksPending: number;
  tasksInProgress: number;
  tasksFailed: number;
  avgCycleTimeMinutes: number | null;
  isStalled: boolean;
  recentTasks: Task[];
}

/** Squads with active tasks and no update within this window are flagged as stalled. */
const STALL_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

export function getSquadTaskMetrics(squadId: string): SquadTaskMetrics {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'done' AND updated_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS completed_recent,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         AVG(CASE WHEN status = 'done'
           THEN (julianday(updated_at) - julianday(created_at)) * 1440
           ELSE NULL END) AS avg_cycle_minutes,
         MAX(CASE WHEN status IN ('pending', 'in_progress') THEN updated_at ELSE NULL END) AS last_active_update
       FROM tasks WHERE squad_id = ?`
    )
    .get(squadId) as {
    total: number;
    completed: number;
    completed_recent: number;
    pending: number;
    in_progress: number;
    failed: number;
    avg_cycle_minutes: number | null;
    last_active_update: string | null;
  };

  // A squad is considered stalled if it has active tasks but none have been
  // updated within STALL_THRESHOLD_MS.
  const hasActiveTasks = row.pending + row.in_progress > 0;
  const isStalled =
    hasActiveTasks &&
    row.last_active_update !== null &&
    new Date(row.last_active_update + "Z").getTime() <
      Date.now() - STALL_THRESHOLD_MS;

  const recentTasks = db
    .prepare(
      "SELECT * FROM tasks WHERE squad_id = ? ORDER BY updated_at DESC LIMIT 5"
    )
    .all(squadId) as Task[];

  return {
    squadId,
    tasksTotal: row.total ?? 0,
    tasksCompleted: row.completed ?? 0,
    tasksCompletedRecent: row.completed_recent ?? 0,
    tasksPending: row.pending ?? 0,
    tasksInProgress: row.in_progress ?? 0,
    tasksFailed: row.failed ?? 0,
    avgCycleTimeMinutes:
      row.avg_cycle_minutes != null
        ? Math.round(row.avg_cycle_minutes * 10) / 10
        : null,
    isStalled,
    recentTasks,
  };
}
