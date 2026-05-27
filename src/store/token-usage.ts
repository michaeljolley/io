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
  cost_usd: number;
  created_at: string;
}

export interface TokenUsageSummary {
  total_records: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

export interface TokenUsageByGroup {
  id: string;
  name: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  record_count: number;
}

export interface DailyTokenUsage {
  date: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

export function recordTokenUsage(params: {
  squadId?: string;
  agentId?: string;
  taskId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): TokenUsageRecord {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO token_usage (id, squad_id, agent_id, task_id, model, input_tokens, output_tokens, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.squadId ?? null,
    params.agentId ?? null,
    params.taskId ?? null,
    params.model,
    params.inputTokens,
    params.outputTokens,
    params.costUsd
  );
  return db.prepare("SELECT * FROM token_usage WHERE id = ?").get(id) as TokenUsageRecord;
}

export function getTokenUsageSummary(opts?: { since?: string }): TokenUsageSummary {
  const db = getDb();
  let sql = `SELECT
    COUNT(*) as total_records,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
    COALESCE(SUM(cost_usd), 0) as total_cost_usd
  FROM token_usage WHERE 1=1`;
  const params: string[] = [];
  if (opts?.since) {
    sql += " AND created_at >= ?";
    params.push(opts.since);
  }
  return db.prepare(sql).get(...params) as TokenUsageSummary;
}

export function getTokenUsageBySquad(opts?: { since?: string }): TokenUsageByGroup[] {
  const db = getDb();
  let sql = `SELECT
    s.id,
    s.name,
    COALESCE(SUM(t.input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(t.output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(t.input_tokens + t.output_tokens), 0) as total_tokens,
    COALESCE(SUM(t.cost_usd), 0) as total_cost_usd,
    COUNT(t.id) as record_count
  FROM squads s
  LEFT JOIN token_usage t ON t.squad_id = s.id`;
  const params: string[] = [];
  if (opts?.since) {
    sql += " AND t.created_at >= ?";
    params.push(opts.since);
  }
  sql += " GROUP BY s.id ORDER BY total_tokens DESC";
  return db.prepare(sql).all(...params) as TokenUsageByGroup[];
}

export function getTokenUsageByAgent(opts?: { squadId?: string; since?: string }): TokenUsageByGroup[] {
  const db = getDb();
  let sql = `SELECT
    a.id,
    a.character_name as name,
    COALESCE(SUM(t.input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(t.output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(t.input_tokens + t.output_tokens), 0) as total_tokens,
    COALESCE(SUM(t.cost_usd), 0) as total_cost_usd,
    COUNT(t.id) as record_count
  FROM agents a
  LEFT JOIN token_usage t ON t.agent_id = a.id`;
  const params: string[] = [];
  const conditions: string[] = [];
  if (opts?.squadId) {
    conditions.push("a.squad_id = ?");
    params.push(opts.squadId);
  }
  if (opts?.since) {
    conditions.push("(t.created_at >= ? OR t.created_at IS NULL)");
    params.push(opts.since);
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " GROUP BY a.id ORDER BY total_tokens DESC";
  return db.prepare(sql).all(...params) as TokenUsageByGroup[];
}

export function getDailyTokenUsage(days = 30): DailyTokenUsage[] {
  const db = getDb();
  const sql = `SELECT
    date(created_at) as date,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
    COALESCE(SUM(cost_usd), 0) as total_cost_usd
  FROM token_usage
  WHERE created_at >= date('now', '-' || ? || ' days')
  GROUP BY date(created_at)
  ORDER BY date ASC`;
  return db.prepare(sql).all(days) as DailyTokenUsage[];
}

export function getTokenUsageForTask(taskId: string): TokenUsageRecord[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM token_usage WHERE task_id = ? ORDER BY created_at ASC")
    .all(taskId) as TokenUsageRecord[];
}
