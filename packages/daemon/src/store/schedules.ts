import type { Schedule } from "@io/shared";
import { CronExpressionParser } from "cron-parser";
import {
	type DatabaseClient,
	asBoolean,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
	toSqliteBoolean,
} from "./db.js";

const parseExpression = CronExpressionParser.parse;

export interface CreateScheduleInput {
	name: string;
	cronExpression: string;
	prompt: string;
	enabled?: boolean;
}

export interface UpdateScheduleInput {
	name?: string;
	cronExpression?: string;
	prompt?: string;
	enabled?: boolean;
}

export async function createSchedule(
	data: CreateScheduleInput,
	db?: DatabaseClient,
): Promise<Schedule> {
	const database = db ?? (await getDatabase());
	const timestamp = nowIso();
	const enabled = data.enabled ?? true;
	const nextRunAt = enabled ? computeNextRunAt(data.cronExpression, timestamp) : null;
	const schedule: Schedule = {
		id: generateId(),
		name: data.name,
		cronExpression: data.cronExpression,
		prompt: data.prompt,
		enabled,
		lastRunAt: null,
		nextRunAt,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await database.execute({
		sql: `INSERT INTO schedules (id, name, cron_expression, prompt, enabled, last_run_at, next_run_at, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			schedule.id,
			schedule.name,
			schedule.cronExpression,
			schedule.prompt,
			toSqliteBoolean(schedule.enabled),
			schedule.lastRunAt,
			schedule.nextRunAt,
			schedule.createdAt,
			schedule.updatedAt,
		],
	});

	return schedule;
}

export async function getSchedule(id: string, db?: DatabaseClient): Promise<Schedule | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM schedules WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];

	return row ? mapSchedule(row) : null;
}

export async function listSchedules(db?: DatabaseClient): Promise<Schedule[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute(
		"SELECT * FROM schedules ORDER BY created_at DESC, id DESC",
	);

	return result.rows.map((row) => mapSchedule(row));
}

export async function updateSchedule(
	id: string,
	data: UpdateScheduleInput,
	db?: DatabaseClient,
): Promise<Schedule | null> {
	const database = db ?? (await getDatabase());
	const existing = await getSchedule(id, database);

	if (!existing) {
		return null;
	}

	const enabled = data.enabled ?? existing.enabled;
	const cronExpression = data.cronExpression ?? existing.cronExpression;
	const lastRunAt = existing.lastRunAt;
	const updatedAt = nowIso();
	const schedule: Schedule = {
		...existing,
		name: data.name ?? existing.name,
		cronExpression,
		prompt: data.prompt ?? existing.prompt,
		enabled,
		lastRunAt,
		nextRunAt: enabled ? computeNextRunAt(cronExpression, lastRunAt ?? updatedAt) : null,
		updatedAt,
	};

	await database.execute({
		sql: `UPDATE schedules
		      SET name = ?, cron_expression = ?, prompt = ?, enabled = ?, last_run_at = ?, next_run_at = ?, updated_at = ?
		      WHERE id = ?`,
		args: [
			schedule.name,
			schedule.cronExpression,
			schedule.prompt,
			toSqliteBoolean(schedule.enabled),
			schedule.lastRunAt,
			schedule.nextRunAt,
			schedule.updatedAt,
			id,
		],
	});

	return schedule;
}

export async function deleteSchedule(id: string, db?: DatabaseClient): Promise<boolean> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "DELETE FROM schedules WHERE id = ?",
		args: [id],
	});

	return result.rowsAffected > 0;
}

export async function getDueSchedules(
	now: string | Date,
	db?: DatabaseClient,
): Promise<Schedule[]> {
	const database = db ?? (await getDatabase());
	const nowValue = typeof now === "string" ? now : now.toISOString();
	const result = await database.execute({
		sql: `SELECT * FROM schedules
		      WHERE enabled = 1
		        AND next_run_at IS NOT NULL
		        AND next_run_at <= ?
		      ORDER BY next_run_at ASC, id ASC`,
		args: [nowValue],
	});

	return result.rows.map((row) => mapSchedule(row));
}

export async function markScheduleRun(
	id: string,
	now: string | Date,
	db?: DatabaseClient,
): Promise<Schedule | null> {
	const database = db ?? (await getDatabase());
	const existing = await getSchedule(id, database);

	if (!existing) {
		return null;
	}

	const lastRunAt = typeof now === "string" ? now : now.toISOString();
	const nextRunAt = existing.enabled ? computeNextRunAt(existing.cronExpression, lastRunAt) : null;
	const updatedAt = nowIso();

	await database.execute({
		sql: "UPDATE schedules SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?",
		args: [lastRunAt, nextRunAt, updatedAt, id],
	});

	return {
		...existing,
		lastRunAt,
		nextRunAt,
		updatedAt,
	};
}

function computeNextRunAt(cronExpression: string, currentDate: string): string {
	const interval = parseExpression(cronExpression, { currentDate });
	const next = interval.next().toISOString();

	if (!next) {
		throw new Error(`Unable to compute next run for cron expression: ${cronExpression}`);
	}

	return next;
}

function mapSchedule(row: Record<string, unknown>): Schedule {
	return {
		id: asString(row.id),
		name: asString(row.name),
		cronExpression: asString(row.cron_expression),
		prompt: asString(row.prompt),
		enabled: asBoolean(row.enabled),
		lastRunAt: asNullableString(row.last_run_at),
		nextRunAt: asNullableString(row.next_run_at),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}
