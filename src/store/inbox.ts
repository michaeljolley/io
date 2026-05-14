import { getDb } from "./db.js";

export interface InboxEntry {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

export function createInboxEntry(title: string, body: string): InboxEntry {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO inbox_entries (title, body) VALUES (?, ?)")
    .run(title, body);
  return db
    .prepare("SELECT * FROM inbox_entries WHERE id = ?")
    .get(info.lastInsertRowid) as InboxEntry;
}

export function listInboxEntries(): InboxEntry[] {
  return getDb()
    .prepare("SELECT * FROM inbox_entries ORDER BY created_at DESC")
    .all() as InboxEntry[];
}

export function deleteInboxEntry(id: number): boolean {
  const info = getDb()
    .prepare("DELETE FROM inbox_entries WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

export function countInboxEntries(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM inbox_entries")
    .get() as { n: number };
  return row.n;
}
