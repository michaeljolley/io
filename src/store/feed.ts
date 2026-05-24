import { getDb } from "./db.js";

export type FeedEntryType = "inbox" | "notification";

export interface FeedEntry {
  id: number;
  type: FeedEntryType;
  title: string;
  body: string;
  source_type: string | null;
  source_ref: string | null;  // raw JSON string
  squad_slug: string | null;
  instance_id: string | null;
  task_id: string | null;
  created_at: string;
  read_at: string | null;
}

export function createFeedEntry(input: {
  type: FeedEntryType;
  title: string;
  body: string;
  source_type?: string;
  source_ref?: string | null;
  squad_slug?: string | null;
  instance_id?: string | null;
  task_id?: string | null;
}): FeedEntry {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO unified_feed (type, title, body, source_type, source_ref, squad_slug, instance_id, task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.title,
      input.body,
      input.source_type ?? null,
      input.source_ref ?? null,
      input.squad_slug ?? null,
      input.instance_id ?? null,
      input.task_id ?? null,
    );
  return db
    .prepare("SELECT * FROM unified_feed WHERE id = ?")
    .get(info.lastInsertRowid) as FeedEntry;
}

export function listFeedEntries(opts?: {
  type?: FeedEntryType;
  unreadOnly?: boolean;
  limit?: number;
  search?: string;
  squad?: string;
}): FeedEntry[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.type) {
    conditions.push("type = ?");
    params.push(opts.type);
  }
  if (opts?.unreadOnly) {
    conditions.push("read_at IS NULL");
  }
  if (opts?.search) {
    conditions.push("(title LIKE ? OR body LIKE ?)");
    const term = `%${opts.search}%`;
    params.push(term, term);
  }
  if (opts?.squad) {
    conditions.push("title LIKE ?");
    params.push(`[${opts.squad}] %`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 50;
  params.push(limit);

  return getDb()
    .prepare(`SELECT * FROM unified_feed ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(...params) as FeedEntry[];
}

export function listFeedSquads(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT substr(title, 2, instr(title, ']') - 2) AS squad
       FROM unified_feed
       WHERE title LIKE '[%]%'
       ORDER BY squad`,
    )
    .all() as { squad: string }[];
  return rows.map((r) => r.squad);
}

export function countUnreadFeedEntries(type?: FeedEntryType): number {
  if (type) {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM unified_feed WHERE read_at IS NULL AND type = ?")
      .get(type) as { n: number };
    return row.n;
  }
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM unified_feed WHERE read_at IS NULL")
    .get() as { n: number };
  return row.n;
}

export function markFeedEntryRead(id: number): boolean {
  const db = getDb();
  const info = db
    .prepare(
      "UPDATE unified_feed SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND read_at IS NULL",
    )
    .run(id);
  if (info.changes > 0) return true;
  // Idempotent: return true if row exists (already read), false if missing
  const exists = db.prepare("SELECT id FROM unified_feed WHERE id = ?").get(id);
  return exists !== undefined;
}

export function markAllFeedEntriesRead(type?: FeedEntryType): number {
  if (type) {
    const info = getDb()
      .prepare(
        "UPDATE unified_feed SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL AND type = ?",
      )
      .run(type);
    return info.changes;
  }
  const info = getDb()
    .prepare("UPDATE unified_feed SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL")
    .run();
  return info.changes;
}

export function deleteFeedEntry(id: number): boolean {
  const info = getDb()
    .prepare("DELETE FROM unified_feed WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

export function pruneOldFeedEntries(olderThanDays: number): number {
  const info = getDb()
    .prepare(
      `DELETE FROM unified_feed WHERE created_at < datetime('now', '-' || ? || ' days')`,
    )
    .run(olderThanDays);
  return info.changes;
}

export function markFeedEntriesRead(ids: number[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const info = getDb()
    .prepare(
      `UPDATE unified_feed SET read_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND read_at IS NULL`,
    )
    .run(...ids);
  return info.changes;
}

export function deleteFeedEntries(ids: number[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const info = getDb()
    .prepare(`DELETE FROM unified_feed WHERE id IN (${placeholders})`)
    .run(...ids);
  return info.changes;
}
