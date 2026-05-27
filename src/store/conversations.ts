import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  source: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  preview: string;
  messageCount: number;
  startedAt: string;
  updatedAt: string;
}

interface RawMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  source: string;
  created_at: string;
}

interface RawSummary {
  id: string;
  preview: string;
  message_count: number;
  started_at: string;
  updated_at: string;
}

function toMessage(row: RawMessage): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as "user" | "assistant",
    content: row.content,
    source: row.source,
    createdAt: row.created_at,
  };
}

function toSummary(row: RawSummary): ConversationSummary {
  return {
    id: row.id,
    preview: row.preview,
    messageCount: row.message_count,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  };
}

export function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  source: string
): ConversationMessage {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO conversation_messages (id, conversation_id, role, content, source) VALUES (?, ?, ?, ?, ?)"
  ).run(id, conversationId, role, content, source);
  const row = db
    .prepare("SELECT * FROM conversation_messages WHERE id = ?")
    .get(id) as RawMessage;
  return toMessage(row);
}

export function getConversation(conversationId: string): ConversationMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )
    .all(conversationId) as RawMessage[];
  return rows.map(toMessage);
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

export function listConversations(opts: ListConversationsOptions = {}): {
  items: ConversationSummary[];
  total: number;
} {
  const db = getDb();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (opts.from) {
    where += " AND started_at >= ?";
    params.push(opts.from);
  }
  if (opts.to) {
    where += " AND updated_at <= ?";
    params.push(opts.to);
  }

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM (
        SELECT conversation_id as id,
               MIN(created_at) as started_at,
               MAX(created_at) as updated_at
        FROM conversation_messages
        GROUP BY conversation_id
      ) ${where}`
    )
    .get(...params) as { cnt: number };
  const total = countRow.cnt;

  const rows = db
    .prepare(
      `SELECT
         sub.id,
         sub.started_at,
         sub.updated_at,
         sub.message_count,
         first_msg.content as preview
       FROM (
         SELECT conversation_id as id,
                MIN(created_at) as started_at,
                MAX(created_at) as updated_at,
                COUNT(*) as message_count
         FROM conversation_messages
         GROUP BY conversation_id
       ) sub
       JOIN conversation_messages first_msg
         ON first_msg.conversation_id = sub.id
        AND first_msg.role = 'user'
        AND first_msg.created_at = (
          SELECT MIN(created_at) FROM conversation_messages
          WHERE conversation_id = sub.id AND role = 'user'
        )
       ${where}
       ORDER BY sub.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as RawSummary[];

  return { items: rows.map(toSummary), total };
}

export interface SearchConversationsOptions {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

export function searchConversations(
  query: string,
  opts: SearchConversationsOptions = {}
): { items: ConversationSummary[]; total: number } {
  const db = getDb();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  let dateWhere = "";
  const dateParams: string[] = [];
  if (opts.from) {
    dateWhere += " AND cm.created_at >= ?";
    dateParams.push(opts.from);
  }
  if (opts.to) {
    dateWhere += " AND cm.created_at <= ?";
    dateParams.push(opts.to);
  }

  // Find distinct conversation IDs matching FTS query
  const matchingIds = db
    .prepare(
      `SELECT DISTINCT cm.conversation_id
       FROM conversation_messages cm
       JOIN conversation_messages_fts fts ON fts.rowid = cm.rowid
       WHERE conversation_messages_fts MATCH ?${dateWhere}
       LIMIT 500`
    )
    .all(query, ...dateParams) as { conversation_id: string }[];

  if (matchingIds.length === 0) {
    return { items: [], total: 0 };
  }

  const idList = matchingIds.map((r) => r.conversation_id);
  const placeholders = idList.map(() => "?").join(",");
  const total = idList.length;

  const rows = db
    .prepare(
      `SELECT
         sub.id,
         sub.started_at,
         sub.updated_at,
         sub.message_count,
         first_msg.content as preview
       FROM (
         SELECT conversation_id as id,
                MIN(created_at) as started_at,
                MAX(created_at) as updated_at,
                COUNT(*) as message_count
         FROM conversation_messages
         WHERE conversation_id IN (${placeholders})
         GROUP BY conversation_id
       ) sub
       JOIN conversation_messages first_msg
         ON first_msg.conversation_id = sub.id
        AND first_msg.role = 'user'
        AND first_msg.created_at = (
          SELECT MIN(created_at) FROM conversation_messages
          WHERE conversation_id = sub.id AND role = 'user'
        )
       ORDER BY sub.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...idList, limit, offset) as RawSummary[];

  return { items: rows.map(toSummary), total };
}

export function deleteConversation(conversationId: string): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM conversation_messages WHERE conversation_id = ?"
  ).run(conversationId);
}
