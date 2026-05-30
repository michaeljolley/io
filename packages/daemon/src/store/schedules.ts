import { CronExpressionParser } from 'cron-parser';
import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from './db.js';

const logger = () => createChildLogger('schedules-store');

export type ScheduleTargetType = 'squad' | 'orchestrator';

export interface Schedule {
	id: string;
	name: string;
	targetType: ScheduleTargetType;
	targetId: string | null;
	cron: string;
	prompt: string;
	enabled: boolean;
	lastRun: string | null;
	nextRun: string | null;
	createdAt: string;
}

/**
 * Calculate the next run time from a cron expression.
 */
export function calculateNextRun(cron: string, from?: Date): Date {
	const interval = CronExpressionParser.parse(cron, { currentDate: from ?? new Date() });
	return interval.next().toDate();
}

/**
 * Create a new schedule.
 */
export async function createSchedule(params: {
	name: string;
	targetType: ScheduleTargetType;
	targetId?: string;
	cron: string;
	prompt: string;
	enabled?: boolean;
}): Promise<Schedule> {
	const db = getDatabase();
	const id = crypto.randomUUID();
	const enabled = params.enabled ?? true;
	const nextRun = enabled ? calculateNextRun(params.cron).toISOString() : null;

	await db.execute({
		sql: `INSERT INTO schedules (id, name, target_type, target_id, cron, prompt, enabled, next_run)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			id,
			params.name,
			params.targetType,
			params.targetId ?? null,
			params.cron,
			params.prompt,
			enabled ? 1 : 0,
			nextRun,
		],
	});

	logger().info({ id, name: params.name, cron: params.cron }, 'Schedule created');

	return {
		id,
		name: params.name,
		targetType: params.targetType,
		targetId: params.targetId ?? null,
		cron: params.cron,
		prompt: params.prompt,
		enabled,
		lastRun: null,
		nextRun,
		createdAt: new Date().toISOString(),
	};
}

/**
 * List all schedules with optional enabled filter.
 */
export async function listSchedules(enabledOnly?: boolean): Promise<Schedule[]> {
	const db = getDatabase();
	const sql = enabledOnly
		? 'SELECT * FROM schedules WHERE enabled = 1 ORDER BY next_run ASC'
		: 'SELECT * FROM schedules ORDER BY created_at DESC';
	const result = await db.execute(sql);
	return result.rows.map(rowToSchedule);
}

/**
 * Get a single schedule by ID.
 */
export async function getSchedule(id: string): Promise<Schedule | null> {
	const db = getDatabase();
	const result = await db.execute({ sql: 'SELECT * FROM schedules WHERE id = ?', args: [id] });
	if (result.rows.length === 0) return null;
	return rowToSchedule(result.rows[0]);
}

/**
 * Update a schedule (partial update).
 */
export async function updateSchedule(
	id: string,
	updates: Partial<Pick<Schedule, 'name' | 'cron' | 'prompt' | 'enabled'>>,
): Promise<void> {
	const db = getDatabase();
	const sets: string[] = [];
	const args: (string | number | null)[] = [];

	if (updates.name !== undefined) {
		sets.push('name = ?');
		args.push(updates.name);
	}
	if (updates.cron !== undefined) {
		sets.push('cron = ?');
		args.push(updates.cron);
		// Recalculate next_run
		sets.push('next_run = ?');
		args.push(calculateNextRun(updates.cron).toISOString());
	}
	if (updates.prompt !== undefined) {
		sets.push('prompt = ?');
		args.push(updates.prompt);
	}
	if (updates.enabled !== undefined) {
		sets.push('enabled = ?');
		args.push(updates.enabled ? 1 : 0);
		if (updates.enabled && !updates.cron) {
			// Need to recalculate next_run from existing cron
			const existing = await getSchedule(id);
			if (existing) {
				sets.push('next_run = ?');
				args.push(calculateNextRun(existing.cron).toISOString());
			}
		}
		if (!updates.enabled) {
			sets.push('next_run = ?');
			args.push(null);
		}
	}

	if (sets.length === 0) return;
	args.push(id);

	await db.execute({
		sql: `UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`,
		args,
	});
}

/**
 * Delete a schedule.
 */
export async function deleteSchedule(id: string): Promise<void> {
	const db = getDatabase();
	await db.execute({ sql: 'DELETE FROM schedules WHERE id = ?', args: [id] });
}

/**
 * Mark a schedule as fired (update last_run and next_run).
 */
export async function markScheduleFired(id: string, cron: string): Promise<void> {
	const db = getDatabase();
	const now = new Date().toISOString();
	const nextRun = calculateNextRun(cron).toISOString();

	await db.execute({
		sql: 'UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?',
		args: [now, nextRun, id],
	});
}

/**
 * Get all schedules that are due to fire (next_run <= now and enabled).
 */
export async function getDueSchedules(): Promise<Schedule[]> {
	const db = getDatabase();
	const now = new Date().toISOString();
	const result = await db.execute({
		sql: 'SELECT * FROM schedules WHERE enabled = 1 AND next_run IS NOT NULL AND next_run <= ?',
		args: [now],
	});
	return result.rows.map(rowToSchedule);
}

function rowToSchedule(row: Record<string, unknown>): Schedule {
	return {
		id: row.id as string,
		name: row.name as string,
		targetType: row.target_type as ScheduleTargetType,
		targetId: row.target_id as string | null,
		cron: row.cron as string,
		prompt: row.prompt as string,
		enabled: (row.enabled as number) === 1,
		lastRun: row.last_run as string | null,
		nextRun: row.next_run as string | null,
		createdAt: row.created_at as string,
	};
}
