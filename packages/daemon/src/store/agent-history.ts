import {
	type DatabaseClient,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
} from "./db.js";

export interface AgentHistoryEntry {
	id: string;
	agentId: string;
	squadId: string | null;
	content: string;
	createdAt: string;
}

export async function appendHistory(
	agentId: string,
	squadId: string,
	content: string,
	db?: DatabaseClient,
): Promise<AgentHistoryEntry> {
	const database = db ?? (await getDatabase());
	const entry: AgentHistoryEntry = {
		id: generateId(),
		agentId,
		squadId,
		content,
		createdAt: nowIso(),
	};

	await database.execute({
		sql: `INSERT INTO agent_history (id, agent_id, squad_id, content, created_at)
		      VALUES (?, ?, ?, ?, ?)`,
		args: [entry.id, entry.agentId, entry.squadId, entry.content, entry.createdAt],
	});

	return entry;
}

export async function getAgentHistory(
	agentId: string,
	limit = 100,
	db?: DatabaseClient,
): Promise<AgentHistoryEntry[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM agent_history WHERE agent_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
		args: [agentId, Math.max(1, limit)],
	});

	return result.rows.map((row) => mapAgentHistory(row));
}

export async function clearAgentHistory(agentId: string, db?: DatabaseClient): Promise<number> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "DELETE FROM agent_history WHERE agent_id = ?",
		args: [agentId],
	});

	return result.rowsAffected;
}

function mapAgentHistory(row: Record<string, unknown>): AgentHistoryEntry {
	return {
		id: asString(row.id),
		agentId: asString(row.agent_id),
		squadId: asNullableString(row.squad_id),
		content: asString(row.content),
		createdAt: asString(row.created_at),
	};
}
