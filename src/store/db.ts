import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "../paths.js";
import { pickSquadColor } from "./squad-colors.js";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = dirname(PATHS.db);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(PATHS.db);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const version = getSchemaVersion(db);

  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS squads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        universe TEXT NOT NULL,
        repo_url TEXT,
        rules TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
        character_name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        persona TEXT DEFAULT '',
        is_lead INTEGER NOT NULL DEFAULT 0,
        is_qa INTEGER NOT NULL DEFAULT 0,
        is_test INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'idle',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
        instance_id TEXT,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
        branch TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_activity TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feed_items (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('squad', 'io')),
        squad_id TEXT REFERENCES squads(id) ON DELETE CASCADE,
        cron TEXT NOT NULL,
        agenda TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS session_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('stdio', 'http')),
        config TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS mcp_tools (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1
      );
    `);
    setSchemaVersion(db, 1);
  }

  if (version < 2) {
    db.exec(`
      ALTER TABLE squads ADD COLUMN slug TEXT;
    `);
    // Backfill slugs for existing squads
    const squads = db.prepare("SELECT id, name FROM squads WHERE slug IS NULL").all() as { id: string; name: string }[];
    const update = db.prepare("UPDATE squads SET slug = ? WHERE id = ?");
    for (const s of squads) {
      const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      update.run(slug || s.id, s.id);
    }
    setSchemaVersion(db, 2);
  }

  if (version < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_agent_events_task_id ON agent_events (task_id);
    `);
    setSchemaVersion(db, 3);
  }

  if (version < 4) {
    db.exec(`
      ALTER TABLE squads ADD COLUMN color TEXT;
    `);
    const squads = db
      .prepare("SELECT id FROM squads WHERE color IS NULL ORDER BY created_at")
      .all() as { id: string }[];
    const update = db.prepare("UPDATE squads SET color = ? WHERE id = ?");
    const usedColors: string[] = [];
    for (let i = 0; i < squads.length; i++) {
      const color = pickSquadColor(usedColors);
      usedColors.push(color);
      update.run(color, squads[i].id);
    }
    setSchemaVersion(db, 4);
  }
}

function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)"
  ).run(String(version));
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}
