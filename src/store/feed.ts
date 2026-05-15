import { getDb } from "./db.js";

export type FeedEntryType = "deliverable" | "notification";

export interface FeedEntry {
  id: number;
  type: FeedEntryType;
  title: string;
  body: string;
  source_type: string | null;
  source_ref: string | null;  // raw JSON string
  created_at: string;
  read_at: string | null;
}

export function createFeedEntry(input: {
  type: FeedEntryType;
  title: string;
  body: string;
  source_type?: string;
  source_ref?: string | null;
}): FeedEntry {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO unified_feed (type, title, body, source_type, source_ref)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.title,
      input.body,
      input.source_type ?? null,
      input.source_ref ?? null,
    );
  return db
    .prepare("SELECT * FROM unified_feed WHERE id = ?")
    .get(info.lastInsertRowid) as FeedEntry;
}

export function listFeedEntries(opts?: {
  type?: FeedEntryType;
  unreadOnly?: boolean;
  limit?: number;
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 50;
  params.push(limit);

  return getDb()
    .prepare(`SELECT * FROM unified_feed ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(...params) as FeedEntry[];
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
