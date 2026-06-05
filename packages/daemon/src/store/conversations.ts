import type { Conversation, Message, MessageRole } from "@io/shared";
import {
	type DatabaseClient,
	asNullableNumber,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
} from "./db.js";

export interface ConversationRecord extends Conversation {
	messages: Message[];
}

export interface MessageTokenUsage {
	inputTokens?: number | null;
	outputTokens?: number | null;
}

export async function createConversation(
	source: Conversation["source"],
	title?: string | null,
	db?: DatabaseClient,
): Promise<Conversation> {
	const database = db ?? (await getDatabase());
	const createdAt = nowIso();
	const conversation: Conversation = {
		id: generateId(),
		title: title ?? null,
		source,
		createdAt,
		updatedAt: createdAt,
	};

	await database.execute({
		sql: `INSERT INTO conversations (id, title, source, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?)`,
		args: [
			conversation.id,
			conversation.title,
			conversation.source,
			conversation.createdAt,
			conversation.updatedAt,
		],
	});

	return conversation;
}

export async function getConversation(
	id: string,
	db?: DatabaseClient,
): Promise<ConversationRecord | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM conversations WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];

	if (!row) {
		return null;
	}

	const conversation = mapConversation(row);
	const messages = await getMessages(id, database);
	return { ...conversation, messages };
}

export async function listConversations(
	limit = 50,
	offset = 0,
	db?: DatabaseClient,
): Promise<Conversation[]> {
	const database = db ?? (await getDatabase());
	const safeLimit = Math.max(1, limit);
	const safeOffset = Math.max(0, offset);
	const result = await database.execute({
		sql: "SELECT * FROM conversations ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ? OFFSET ?",
		args: [safeLimit, safeOffset],
	});

	return result.rows.map((row) => mapConversation(row));
}

export async function appendMessage(
	conversationId: string,
	role: MessageRole,
	content: string,
	model?: string | null,
	tokens?: MessageTokenUsage,
	db?: DatabaseClient,
): Promise<Message> {
	const database = db ?? (await getDatabase());
	const message: Message = {
		id: generateId(),
		conversationId,
		role,
		content,
		model: model ?? null,
		inputTokens: tokens?.inputTokens ?? null,
		outputTokens: tokens?.outputTokens ?? null,
		createdAt: nowIso(),
	};

	await database.execute({
		sql: `INSERT INTO messages (id, conversation_id, role, content, model, input_tokens, output_tokens, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			message.id,
			message.conversationId,
			message.role,
			message.content,
			message.model,
			message.inputTokens,
			message.outputTokens,
			message.createdAt,
		],
	});
	await database.execute({
		sql: "UPDATE conversations SET updated_at = ? WHERE id = ?",
		args: [message.createdAt, conversationId],
	});

	return message;
}

export async function getMessages(conversationId: string, db?: DatabaseClient): Promise<Message[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
		args: [conversationId],
	});

	return result.rows.map((row) => mapMessage(row));
}

export async function deleteConversation(id: string, db?: DatabaseClient): Promise<boolean> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "DELETE FROM conversations WHERE id = ?",
		args: [id],
	});

	return result.rowsAffected > 0;
}

export async function getConversationMessageCount(
	id: string,
	db?: DatabaseClient,
): Promise<number> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?",
		args: [id],
	});

	return result.rows[0] ? Number(result.rows[0].count) : 0;
}

function mapConversation(row: Record<string, unknown>): Conversation {
	return {
		id: asString(row.id),
		title: asNullableString(row.title),
		source: asString(row.source) as Conversation["source"],
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}

function mapMessage(row: Record<string, unknown>): Message {
	return {
		id: asString(row.id),
		conversationId: asString(row.conversation_id),
		role: asString(row.role) as MessageRole,
		content: asString(row.content),
		model: asNullableString(row.model),
		inputTokens: asNullableNumber(row.input_tokens),
		outputTokens: asNullableNumber(row.output_tokens),
		createdAt: asString(row.created_at),
	};
}
