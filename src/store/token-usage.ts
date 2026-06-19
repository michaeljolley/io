import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface TokenUsageRecord {
  id: string;
  squad_id: string | null;
  agent_id: string | null;
  task_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface TokenUsageSummary {
  total_records: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

export interface TokenUsageByGroup {
  id: string;
  name: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  record_count: number;
}

export interface DailyTokenUsage {
  date: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

interface DateRangeOpts {
  since?: string;
  from?: string;
  to?: string;
}

function buildDateFilter(opts: DateRangeOpts | undefined, alias: string): { clause: string; params: string[] } {
  if (!opts) return { clause: "", params: [] };
  const conditions: string[] = [];
  const params: string[] = [];
  if (opts.from) {
    conditions.push(`${alias}.created_at >= ?`);
    params.push(`${opts.from}T00:00:00`);
  } else if (opts.since) {
    conditions.push(`${alias}.created_at >= ?`);
    params.push(opts.since);
  }
  if (opts.to) {
    conditions.push(`${alias}.created_at < date(?, '+1 day')`);
    params.push(opts.to);
  }
  return { clause: conditions.length ? " AND " + conditions.join(" AND ") : "", params };
}

export function recordTokenUsage(params: {
  squadId?: string;
  agentId?: string;
  taskId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): TokenUsageRecord {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO token_usage (id, squad_id, agent_id, task_id, model, input_tokens, output_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.squadId ?? null,
    params.agentId ?? null,
    params.taskId ?? null,
    params.model,
    params.inputTokens,
    params.outputTokens
  );
  return db.prepare("SELECT * FROM token_usage WHERE id = ?").get(id) as TokenUsageRecord;
}

export function getTokenUsageSummary(opts?: DateRangeOpts): TokenUsageSummary {
  const db = getDb();
  const { clause, params } = buildDateFilter(opts, "token_usage");
  const sql = `SELECT
    COUNT(*) as total_records,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
  FROM token_usage WHERE 1=1${clause}`;
  return db.prepare(sql).get(...params) as TokenUsageSummary;
}

export function getTokenUsageBySquad(opts?: DateRangeOpts): TokenUsageByGroup[] {
  const db = getDb();
  const { clause, params } = buildDateFilter(opts, "t");
  const sql = `SELECT
    s.id,
    s.name,
    COALESCE(SUM(t.input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(t.output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(t.input_tokens + t.output_tokens), 0) as total_tokens,
    COUNT(t.id) as record_count
  FROM squads s
  LEFT JOIN token_usage t ON t.squad_id = s.id${clause}
  GROUP BY s.id ORDER BY total_tokens DESC`;
  return db.prepare(sql).all(...params) as TokenUsageByGroup[];
}

export function getTokenUsageByAgent(opts?: { squadId?: string } & DateRangeOpts): TokenUsageByGroup[] {
  const db = getDb();
  const { clause: dateClause, params: dateParams } = buildDateFilter(opts, "t");
  let sql = `SELECT
    a.id,
    a.character_name as name,
    COALESCE(SUM(t.input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(t.output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(t.input_tokens + t.output_tokens), 0) as total_tokens,
    COUNT(t.id) as record_count
  FROM agents a
  LEFT JOIN token_usage t ON t.agent_id = a.id${dateClause}`;
  const params: string[] = [...dateParams];
  if (opts?.squadId) {
    sql += " WHERE a.squad_id = ?";
    params.push(opts.squadId);
  }
  sql += " GROUP BY a.id ORDER BY total_tokens DESC";
  return db.prepare(sql).all(...params) as TokenUsageByGroup[];
}

export function getDailyTokenUsage(opts?: { days?: number } & DateRangeOpts): DailyTokenUsage[] {
  const db = getDb();
  const params: (string | number)[] = [];
  let whereClause: string;
  if (opts?.from || opts?.to) {
    const conditions: string[] = [];
    if (opts.from) {
      conditions.push("created_at >= ?");
      params.push(`${opts.from}T00:00:00`);
    }
    if (opts.to) {
      conditions.push("created_at < date(?, '+1 day')");
      params.push(opts.to);
    }
    whereClause = "WHERE " + conditions.join(" AND ");
  } else {
    const days = opts?.days ?? 30;
    whereClause = "WHERE created_at >= date('now', '-' || ? || ' days')";
    params.push(days);
  }
  const sql = `SELECT
    date(created_at) as date,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
  FROM token_usage
  ${whereClause}
  GROUP BY date(created_at)
  ORDER BY date ASC`;
  return db.prepare(sql).all(...params) as DailyTokenUsage[];
}

export function getTokenUsageForTask(taskId: string): TokenUsageRecord[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM token_usage WHERE task_id = ? ORDER BY created_at ASC")
    .all(taskId) as TokenUsageRecord[];
}
