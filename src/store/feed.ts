import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface FeedItem {
  id: string;
  source: string;
  title: string;
  content: string;
  read: number;
  created_at: string;
}

export function postFeedItem(source: string, title: string, content: string): FeedItem {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO feed_items (id, source, title, content) VALUES (?, ?, ?, ?)"
  ).run(id, source, title, content);
  return db.prepare("SELECT * FROM feed_items WHERE id = ?").get(id) as FeedItem;
}

export function getFeedItems(opts?: {
  unreadOnly?: boolean;
  source?: string;
  limit?: number;
  offset?: number;
}): FeedItem[] {
  const db = getDb();
  let sql = "SELECT * FROM feed_items WHERE 1=1";
  const params: any[] = [];

  if (opts?.unreadOnly) {
    sql += " AND read = 0";
  }
  if (opts?.source) {
    sql += " AND source = ?";
    params.push(opts.source);
  }

  sql += " ORDER BY created_at DESC";

  if (opts?.limit) {
    sql += " LIMIT ?";
    params.push(opts.limit);
  }
  if (opts?.offset) {
    sql += " OFFSET ?";
    params.push(opts.offset);
  }

  return db.prepare(sql).all(...params) as FeedItem[];
}

export function markFeedItemRead(id: string): void {
  const db = getDb();
  db.prepare("UPDATE feed_items SET read = 1 WHERE id = ?").run(id);
}

export function deleteFeedItem(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM feed_items WHERE id = ?").run(id);
}

export function getUnreadCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM feed_items WHERE read = 0").get() as {
    count: number;
  };
  return row.count;
}
