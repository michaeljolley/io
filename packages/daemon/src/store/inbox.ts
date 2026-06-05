import type { InboxItem, InboxItemStatus, InboxItemType } from "@io/shared";
import {
	type DatabaseClient,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
} from "./db.js";

export interface CreateInboxItemInput {
	squadId?: string | null;
	objectiveId?: string | null;
	type: InboxItemType;
	title: string;
	content: string;
	status?: InboxItemStatus;
}

export async function createInboxItem(
	data: CreateInboxItemInput,
	db?: DatabaseClient,
): Promise<InboxItem> {
	const database = db ?? (await getDatabase());
	const timestamp = nowIso();
	const item: InboxItem = {
		id: generateId(),
		squadId: data.squadId ?? null,
		objectiveId: data.objectiveId ?? null,
		type: data.type,
		title: data.title,
		content: data.content,
		status: data.status ?? "pending",
		reply: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await database.execute({
		sql: `INSERT INTO inbox (id, squad_id, objective_id, type, title, content, status, reply, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			item.id,
			item.squadId,
			item.objectiveId,
			item.type,
			item.title,
			item.content,
			item.status,
			item.reply,
			item.createdAt,
			item.updatedAt,
		],
	});

	return item;
}

export async function listInboxItems(
	status?: InboxItemStatus,
	limit = 50,
	offset = 0,
	db?: DatabaseClient,
): Promise<InboxItem[]> {
	const database = db ?? (await getDatabase());
	const safeLimit = Math.max(1, limit);
	const safeOffset = Math.max(0, offset);
	const hasStatusFilter = typeof status === "string";
	const result = await database.execute({
		sql: `SELECT * FROM inbox ${hasStatusFilter ? "WHERE status = ?" : ""}
		      ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
		args: hasStatusFilter ? [status, safeLimit, safeOffset] : [safeLimit, safeOffset],
	});

	return result.rows.map((row) => mapInboxItem(row));
}

export async function getInboxItem(id: string, db?: DatabaseClient): Promise<InboxItem | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM inbox WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];

	return row ? mapInboxItem(row) : null;
}

export async function replyToItem(
	id: string,
	reply: string,
	db?: DatabaseClient,
): Promise<InboxItem | null> {
	const database = db ?? (await getDatabase());
	const updatedAt = nowIso();
	const result = await database.execute({
		sql: "UPDATE inbox SET reply = ?, status = 'replied', updated_at = ? WHERE id = ?",
		args: [reply, updatedAt, id],
	});

	if (result.rowsAffected === 0) {
		return null;
	}

	return getInboxItem(id, database);
}

export async function markRead(id: string, db?: DatabaseClient): Promise<InboxItem | null> {
	const database = db ?? (await getDatabase());
	const updatedAt = nowIso();
	const result = await database.execute({
		sql: "UPDATE inbox SET status = 'read', updated_at = ? WHERE id = ? AND status = 'pending'",
		args: [updatedAt, id],
	});

	if (result.rowsAffected === 0) {
		return getInboxItem(id, database);
	}

	return getInboxItem(id, database);
}

export async function resolveItem(id: string, db?: DatabaseClient): Promise<InboxItem | null> {
	const database = db ?? (await getDatabase());
	const updatedAt = nowIso();
	const result = await database.execute({
		sql: "UPDATE inbox SET status = 'resolved', updated_at = ? WHERE id = ?",
		args: [updatedAt, id],
	});

	if (result.rowsAffected === 0) {
		return null;
	}

	return getInboxItem(id, database);
}

export async function getPendingBlockingQuestions(
	squadId?: string,
	db?: DatabaseClient,
): Promise<InboxItem[]> {
	const database = db ?? (await getDatabase());
	const hasSquadFilter = typeof squadId === "string";
	const result = await database.execute({
		sql: `SELECT * FROM inbox
		      WHERE type = 'blocking_question'
		        AND reply IS NULL
		        AND status IN ('pending', 'read')
		        ${hasSquadFilter ? "AND squad_id = ?" : ""}
		      ORDER BY created_at ASC, id ASC`,
		args: hasSquadFilter ? [squadId] : [],
	});

	return result.rows.map((row) => mapInboxItem(row));
}

function mapInboxItem(row: Record<string, unknown>): InboxItem {
	return {
		id: asString(row.id),
		squadId: asNullableString(row.squad_id),
		objectiveId: asNullableString(row.objective_id),
		type: asString(row.type) as InboxItemType,
		title: asString(row.title),
		content: asString(row.content),
		status: asString(row.status) as InboxItemStatus,
		reply: asNullableString(row.reply),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}
