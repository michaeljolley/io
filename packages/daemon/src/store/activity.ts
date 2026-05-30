import type { IOEvent } from '@io/shared';
import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from './db.js';

const logger = () => createChildLogger('activity-log');

export type ActivityType =
	| 'tool_call'
	| 'message'
	| 'meeting_contribution'
	| 'task_start'
	| 'task_complete'
	| 'error';

export interface ActivityEntry {
	id: number;
	squadId: string | null;
	instanceId: string | null;
	agentRole: string;
	activityType: ActivityType;
	modelUsed: string | null;
	content: string | null;
	tokensUsed: number | null;
	timestamp: string;
}

/**
 * Log an activity to the agent_activity table.
 */
export async function logActivity(entry: {
	squadId?: string;
	instanceId?: string;
	agentRole: string;
	activityType: ActivityType;
	modelUsed?: string;
	content?: unknown;
	tokensUsed?: number;
}): Promise<void> {
	const db = getDatabase();
	try {
		await db.execute({
			sql: `INSERT INTO agent_activity (squad_id, instance_id, agent_role, activity_type, model_used, content, tokens_used)
			      VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				entry.squadId ?? null,
				entry.instanceId ?? null,
				entry.agentRole,
				entry.activityType,
				entry.modelUsed ?? null,
				entry.content ? JSON.stringify(entry.content) : null,
				entry.tokensUsed ?? null,
			],
		});
	} catch (err) {
		logger().error({ err }, 'Failed to log activity');
	}
}

/**
 * Query activity entries with optional filters.
 */
export async function queryActivity(filters: {
	squadId?: string;
	instanceId?: string;
	agentRole?: string;
	activityType?: ActivityType;
	limit?: number;
	offset?: number;
}): Promise<ActivityEntry[]> {
	const db = getDatabase();
	const conditions: string[] = [];
	const args: (string | number)[] = [];

	if (filters.squadId) {
		conditions.push('squad_id = ?');
		args.push(filters.squadId);
	}
	if (filters.instanceId) {
		conditions.push('instance_id = ?');
		args.push(filters.instanceId);
	}
	if (filters.agentRole) {
		conditions.push('agent_role = ?');
		args.push(filters.agentRole);
	}
	if (filters.activityType) {
		conditions.push('activity_type = ?');
		args.push(filters.activityType);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = filters.limit ?? 50;
	const offset = filters.offset ?? 0;

	const result = await db.execute({
		sql: `SELECT id, squad_id, instance_id, agent_role, activity_type, model_used, content, tokens_used, timestamp
		      FROM agent_activity ${where}
		      ORDER BY timestamp DESC
		      LIMIT ? OFFSET ?`,
		args: [...args, limit, offset],
	});

	return result.rows.map((row) => ({
		id: row.id as number,
		squadId: row.squad_id as string | null,
		instanceId: row.instance_id as string | null,
		agentRole: row.agent_role as string,
		activityType: row.activity_type as ActivityType,
		modelUsed: row.model_used as string | null,
		content: row.content as string | null,
		tokensUsed: row.tokens_used as number | null,
		timestamp: row.timestamp as string,
	}));
}

/**
 * Subscribe to the event bus and auto-log relevant events.
 */
export function initActivityLogger(eventBus: {
	onAny: (handler: (event: IOEvent) => void) => () => void;
}): () => void {
	return eventBus.onAny((event: IOEvent) => {
		const entry = mapEventToActivity(event);
		if (entry) {
			logActivity(entry);
		}
	});
}

function mapEventToActivity(event: IOEvent): Parameters<typeof logActivity>[0] | null {
	switch (event.type) {
		case 'agent:task_started':
			return {
				squadId: event.squadId,
				instanceId: event.instanceId,
				agentRole: event.agentRole,
				activityType: 'task_start',
				content: event.data,
			};
		case 'agent:task_completed':
			return {
				squadId: event.squadId,
				instanceId: event.instanceId,
				agentRole: event.agentRole,
				activityType: 'task_complete',
				content: event.data,
			};
		case 'agent:tool_call':
			return {
				squadId: event.squadId,
				instanceId: event.instanceId,
				agentRole: event.agentRole,
				activityType: 'tool_call',
				modelUsed: event.model,
				content: event.data,
			};
		case 'agent:error':
			return {
				squadId: event.squadId,
				instanceId: event.instanceId,
				agentRole: event.agentRole,
				activityType: 'error',
				content: event.data,
			};
		case 'meeting:contribution':
			return {
				squadId: event.squadId,
				instanceId: event.instanceId,
				agentRole: event.agentRole,
				activityType: 'meeting_contribution',
				content: { message: event.content },
			};
		default:
			return null;
	}
}
