import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { DB_PATH, IO_HOME } from "../paths.js";

let db: BetterSqlite3.Database | null = null;
let insertCount = 0;
let dbPathOverride: string | null = null;

/**
 * Override the DB path for tests. Closes the existing connection (if any)
 * so the next getDb() call opens a fresh DB at the given path.
 * Never call this in production code.
 */
export function setDbPathForTests(path: string): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPathOverride = path;
}

export function getDb(): BetterSqlite3.Database {
  if (db) return db;

  const resolvedPath = dbPathOverride ?? DB_PATH;
  const resolvedHome = dbPathOverride ? dirname(resolvedPath) : IO_HOME;
  mkdirSync(resolvedHome, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS io_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS squads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      copilot_session_id TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS squad_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_slug TEXT NOT NULL,
      decision TEXT NOT NULL,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      ts DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      task_id TEXT PRIMARY KEY,
      agent_slug TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      result TEXT,
      origin_channel TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );
  `);

  // Migrations for existing databases
  const migrations: string[] = [
    `ALTER TABLE squads ADD COLUMN model TEXT`,
    `ALTER TABLE squads ADD COLUMN universe TEXT`,
    `CREATE TABLE IF NOT EXISTS squad_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_slug TEXT NOT NULL,
      character_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      charter TEXT,
      model_tier TEXT NOT NULL DEFAULT 'medium',
      personality TEXT,
      copilot_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(squad_slug, character_name)
    )`,
    `ALTER TABLE squad_agents ADD COLUMN is_lead INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE squad_agents ADD COLUMN is_qa INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS squad_task_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      squad_slug TEXT NOT NULL,
      reviewer_character TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS squad_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      cron_expr TEXT NOT NULL,
      agenda TEXT NOT NULL,
      notes TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_squad_schedules_due
       ON squad_schedules (enabled, next_run_at)`,
    `CREATE TABLE IF NOT EXISTS io_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cron_expr TEXT NOT NULL,
      prompt TEXT NOT NULL,
      notes TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_io_schedules_due
       ON io_schedules (enabled, next_run_at)`,
    `CREATE VIEW IF NOT EXISTS agent_stats AS
SELECT agent_slug,
       COUNT(*)        AS task_count,
       MAX(started_at) AS last_delegated_at
FROM agent_tasks
GROUP BY agent_slug`,
    `CREATE TABLE IF NOT EXISTS background_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bg_notifications_unread ON background_notifications(read_at, created_at)`,
    `CREATE TABLE IF NOT EXISTS schedule_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_type TEXT NOT NULL,
      schedule_id INTEGER NOT NULL,
      schedule_name TEXT NOT NULL,
      squad_slug TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      error_text TEXT,
      notification_id INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )`,
    `CREATE INDEX IF NOT EXISTS idx_schedule_runs_lookup ON schedule_runs(schedule_type, schedule_id, started_at)`,
    `CREATE TABLE IF NOT EXISTS inbox_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS unified_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('deliverable', 'notification')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      source_type TEXT,
      source_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME
    )`,
    `CREATE INDEX IF NOT EXISTS idx_unified_feed_type ON unified_feed(type, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_unified_feed_unread ON unified_feed(read_at, created_at)`,
    `CREATE TABLE IF NOT EXISTS squad_instances (
      id TEXT PRIMARY KEY,
      master_squad_slug TEXT NOT NULL,
      issue_ref TEXT,
      worktree_path TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      context_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS instance_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      context TEXT,
      merged_to_master INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE agent_tasks ADD COLUMN instance_id TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_instance_decisions_instance ON instance_decisions(instance_id, merged_to_master)`,
  ];

  for (const migration of migrations) {
    try {
      db.exec(migration);
    } catch {
      // Already applied — ignore
    }
  }

  // One-time data migration: copy inbox_entries + background_notifications → unified_feed
  try {
    const migrated = db.prepare("SELECT value FROM io_state WHERE key = 'unified_feed_migrated'").get() as { value: string } | undefined;
    if (!migrated) {
      db.exec(`
        INSERT OR IGNORE INTO unified_feed (type, title, body, source_type, source_ref, created_at, read_at)
        SELECT 'deliverable', title, body, NULL, NULL, created_at, NULL
        FROM inbox_entries
      `);
      db.exec(`
        INSERT OR IGNORE INTO unified_feed (type, title, body, source_type, source_ref, created_at, read_at)
        SELECT 'notification', title, text, source_type, source_ref, created_at, read_at
        FROM background_notifications
      `);
      db.prepare("INSERT OR REPLACE INTO io_state (key, value) VALUES ('unified_feed_migrated', '1')").run();
    }
  } catch {
    // Migration failed (e.g. old tables don't exist yet on a fresh install) — safe to ignore
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getState(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM io_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setState(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO io_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function deleteState(key: string): void {
  getDb().prepare("DELETE FROM io_state WHERE key = ?").run(key);
}

export function logConversation(
  role: "user" | "assistant" | "system",
  content: string,
  source: string,
): void {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO conversation_log (role, content, source) VALUES (?, ?, ?)",
    )
    .run(role, content, source);

  insertCount++;
  if (insertCount % 50 === 0) {
    database
      .prepare(
        "DELETE FROM conversation_log WHERE id NOT IN (SELECT id FROM conversation_log ORDER BY id DESC LIMIT 1000)",
      )
      .run();
  }
}

export interface ConversationEntry {
  role: string;
  content: string;
  source: string;
  ts: string;
}

export function getRecentConversation(limit = 50): ConversationEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT role, content, source, ts FROM conversation_log ORDER BY id DESC LIMIT ?",
    )
    .all(limit) as ConversationEntry[];

  return rows.reverse().map((row) => ({
    ...row,
    content:
      row.content.length > 1500
        ? row.content.slice(0, 1500) + "…"
        : row.content,
  }));
}
