import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface AgentEvent {
  id: string;
  task_id: string;
  type: string;
  summary: string;
  payload: string;
  created_at: string;
}

export function addAgentEvent(
  taskId: string,
  type: string,
  summary: string,
  payload: object
): AgentEvent {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO agent_events (id, task_id, type, summary, payload) VALUES (?, ?, ?, ?, ?)"
  ).run(id, taskId, type, summary, JSON.stringify(payload));
  return db.prepare("SELECT * FROM agent_events WHERE id = ?").get(id) as AgentEvent;
}

export function getAgentEvents(taskId: string): AgentEvent[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agent_events WHERE task_id = ? ORDER BY created_at ASC")
    .all(taskId) as AgentEvent[];
}

export function clearAgentEvents(taskId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM agent_events WHERE task_id = ?").run(taskId);
}
