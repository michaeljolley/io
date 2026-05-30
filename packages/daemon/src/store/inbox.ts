import { createChildLogger } from '../logging/logger.js';
import { getEventBus } from '../squad/event-bus.js';
import { getDatabase } from './db.js';

const logger = () => createChildLogger('inbox');

export type InboxKind = 'deliverable' | 'question';
export type InboxStatus = 'unread' | 'read' | 'resolved';

export interface InboxEntry {
	id: string;
	squadId: string;
	instanceId: string | null;
	kind: InboxKind;
	title: string;
	content: string;
	status: InboxStatus;
	response: string | null;
	createdAt: string;
	resolvedAt: string | null;
}

// Pending question resolvers — keyed by entry ID
const pendingQuestions = new Map<string, (response: string) => void>();

/**
 * Add a new inbox entry. For questions, returns a promise that resolves when the user responds.
 */
export async function addInboxEntry(params: {
	squadId: string;
	instanceId?: string;
	kind: InboxKind;
	title: string;
	content: string;
}): Promise<{ entry: InboxEntry; waitForResponse?: Promise<string> }> {
	const db = getDatabase();
	const id = crypto.randomUUID();

	await db.execute({
		sql: `INSERT INTO inbox_entries (id, squad_id, instance_id, kind, title, content)
		      VALUES (?, ?, ?, ?, ?, ?)`,
		args: [
			id,
			params.squadId,
			params.instanceId ?? null,
			params.kind,
			params.title,
			params.content,
		],
	});

	const entry: InboxEntry = {
		id,
		squadId: params.squadId,
		instanceId: params.instanceId ?? null,
		kind: params.kind,
		title: params.title,
		content: params.content,
		status: 'unread',
		response: null,
		createdAt: new Date().toISOString(),
		resolvedAt: null,
	};

	let waitForResponse: Promise<string> | undefined;

	if (params.kind === 'question') {
		waitForResponse = new Promise<string>((resolve) => {
			pendingQuestions.set(id, resolve);
		});
	}

	// Emit event for WebSocket broadcast
	getEventBus().emit({
		type: 'inbox:new',
		id: crypto.randomUUID(),
		timestamp: new Date(),
		squadId: params.squadId,
		instanceId: params.instanceId,
		kind: params.kind,
		title: params.title,
		entryId: id,
	});

	logger().info({ id, kind: params.kind, title: params.title }, 'Inbox entry created');
	return { entry, waitForResponse };
}

/**
 * List inbox entries with optional filters.
 */
export async function listInboxEntries(filters?: {
	status?: InboxStatus;
	squadId?: string;
	kind?: InboxKind;
	limit?: number;
}): Promise<InboxEntry[]> {
	const db = getDatabase();
	const conditions: string[] = [];
	const args: (string | number)[] = [];

	if (filters?.status) {
		conditions.push('status = ?');
		args.push(filters.status);
	}
	if (filters?.squadId) {
		conditions.push('squad_id = ?');
		args.push(filters.squadId);
	}
	if (filters?.kind) {
		conditions.push('kind = ?');
		args.push(filters.kind);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = filters?.limit ?? 50;

	const result = await db.execute({
		sql: `SELECT id, squad_id, instance_id, kind, title, content, status, response, created_at, resolved_at
		      FROM inbox_entries ${where}
		      ORDER BY created_at DESC
		      LIMIT ?`,
		args: [...args, limit],
	});

	return result.rows.map(rowToEntry);
}

/**
 * Get a single inbox entry by ID.
 */
export async function getInboxEntry(id: string): Promise<InboxEntry | null> {
	const db = getDatabase();
	const result = await db.execute({
		sql: 'SELECT id, squad_id, instance_id, kind, title, content, status, response, created_at, resolved_at FROM inbox_entries WHERE id = ?',
		args: [id],
	});
	if (result.rows.length === 0) return null;
	return rowToEntry(result.rows[0]);
}

/**
 * Mark an entry as read.
 */
export async function markInboxRead(id: string): Promise<void> {
	const db = getDatabase();
	await db.execute({
		sql: "UPDATE inbox_entries SET status = 'read' WHERE id = ? AND status = 'unread'",
		args: [id],
	});
}

/**
 * Respond to an inbox question. Resolves the blocking promise if the squad is waiting.
 */
export async function resolveInboxEntry(id: string, response: string): Promise<boolean> {
	const db = getDatabase();
	await db.execute({
		sql: "UPDATE inbox_entries SET status = 'resolved', response = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
		args: [response, id],
	});

	// Resolve the pending promise if squad is waiting
	const resolver = pendingQuestions.get(id);
	if (resolver) {
		resolver(response);
		pendingQuestions.delete(id);
		logger().info({ id }, 'Inbox question resolved — squad unblocked');
		return true;
	}

	return false;
}

/**
 * Get count of unread entries.
 */
export async function getUnreadCount(): Promise<number> {
	const db = getDatabase();
	const result = await db.execute(
		"SELECT COUNT(*) as count FROM inbox_entries WHERE status = 'unread'",
	);
	return (result.rows[0]?.count as number) ?? 0;
}

function rowToEntry(row: Record<string, unknown>): InboxEntry {
	return {
		id: row.id as string,
		squadId: row.squad_id as string,
		instanceId: row.instance_id as string | null,
		kind: row.kind as InboxKind,
		title: row.title as string,
		content: row.content as string,
		status: row.status as InboxStatus,
		response: row.response as string | null,
		createdAt: row.created_at as string,
		resolvedAt: row.resolved_at as string | null,
	};
}
