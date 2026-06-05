import type { Activity } from "@io/shared";
import {
	type DatabaseClient,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
	parseJson,
	serializeJson,
} from "./db.js";

export interface LogActivityInput {
	squadId?: string | null;
	objectiveId?: string | null;
	event: string;
	description: string;
	metadata?: Record<string, unknown> | null;
	createdAt?: string;
}

export async function logActivity(data: LogActivityInput, db?: DatabaseClient): Promise<Activity> {
	const database = db ?? (await getDatabase());
	const activity: Activity = {
		id: generateId(),
		squadId: data.squadId ?? null,
		objectiveId: data.objectiveId ?? null,
		event: data.event,
		description: data.description,
		metadata: data.metadata ?? null,
		createdAt: data.createdAt ?? nowIso(),
	};

	await database.execute({
		sql: `INSERT INTO activity (id, squad_id, objective_id, event, description, metadata, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			activity.id,
			activity.squadId,
			activity.objectiveId,
			activity.event,
			activity.description,
			activity.metadata ? serializeJson(activity.metadata) : null,
			activity.createdAt,
		],
	});

	return activity;
}

export async function getRecentActivity(
	limit = 50,
	offset = 0,
	db?: DatabaseClient,
): Promise<Activity[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM activity ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
		args: [Math.max(1, limit), Math.max(0, offset)],
	});

	return result.rows.map((row) => mapActivity(row));
}

export async function getSquadActivity(
	squadId: string,
	limit = 50,
	offset = 0,
	db?: DatabaseClient,
): Promise<Activity[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM activity WHERE squad_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
		args: [squadId, Math.max(1, limit), Math.max(0, offset)],
	});

	return result.rows.map((row) => mapActivity(row));
}

export async function getObjectiveActivity(
	objectiveId: string,
	db?: DatabaseClient,
): Promise<Activity[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM activity WHERE objective_id = ? ORDER BY created_at DESC, id DESC",
		args: [objectiveId],
	});

	return result.rows.map((row) => mapActivity(row));
}

function mapActivity(row: Record<string, unknown>): Activity {
	return {
		id: asString(row.id),
		squadId: asNullableString(row.squad_id),
		objectiveId: asNullableString(row.objective_id),
		event: asString(row.event),
		description: asString(row.description),
		metadata: row.metadata ? parseJson<Record<string, unknown>>(asString(row.metadata)) : null,
		createdAt: asString(row.created_at),
	};
}
