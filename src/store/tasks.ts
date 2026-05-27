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
