import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface AuditEntry {
  id: string;
  squad_id: string | null;
  agent_id: string | null;
  task_id: string | null;
  action_type: string;
  summary: string;
  payload: string;
  created_at: string;
}

export interface AuditLogFilters {
  squad_id?: string;
  agent_id?: string;
  action_type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function addAuditEntry(
  action_type: string,
  summary: string,
  payload: object,
  opts?: { squad_id?: string; agent_id?: string; task_id?: string }
): AuditEntry {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO audit_log (id, squad_id, agent_id, task_id, action_type, summary, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    opts?.squad_id ?? null,
    opts?.agent_id ?? null,
    opts?.task_id ?? null,
    action_type,
    summary,
    JSON.stringify(payload)
  );
  return db.prepare("SELECT * FROM audit_log WHERE id = ?").get(id) as AuditEntry;
}

export function getAuditLog(filters: AuditLogFilters = {}): AuditEntry[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.squad_id) {
    conditions.push("squad_id = ?");
    params.push(filters.squad_id);
  }
  if (filters.agent_id) {
    conditions.push("agent_id = ?");
    params.push(filters.agent_id);
  }
  if (filters.action_type) {
    conditions.push("action_type = ?");
    params.push(filters.action_type);
  }
  if (filters.from) {
    conditions.push("created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("created_at <= ?");
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  return db
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AuditEntry[];
}

export function countAuditLog(filters: AuditLogFilters = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.squad_id) {
    conditions.push("squad_id = ?");
    params.push(filters.squad_id);
  }
  if (filters.agent_id) {
    conditions.push("agent_id = ?");
    params.push(filters.agent_id);
  }
  if (filters.action_type) {
    conditions.push("action_type = ?");
    params.push(filters.action_type);
  }
  if (filters.from) {
    conditions.push("created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("created_at <= ?");
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`)
    .get(...params) as { count: number };
  return row.count;
}
