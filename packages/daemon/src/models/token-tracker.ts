import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from '../store/db.js';

const logger = () => createChildLogger('token-tracker');

export interface TokenUsageRecord {
	squadId?: string;
	instanceId?: string;
	agentRole?: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd?: number;
}

/**
 * Record token usage from an LLM call.
 */
export async function recordTokenUsage(record: TokenUsageRecord): Promise<void> {
	const db = getDatabase();

	// Estimate cost if pricing is available
	let cost = record.estimatedCostUsd;
	if (cost === undefined) {
		cost = await estimateCost(record.model, record.inputTokens, record.outputTokens);
	}

	await db.execute({
		sql: `INSERT INTO token_usage (squad_id, instance_id, agent_role, model, input_tokens, output_tokens, estimated_cost_usd)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			record.squadId ?? null,
			record.instanceId ?? null,
			record.agentRole ?? null,
			record.model,
			record.inputTokens,
			record.outputTokens,
			cost ?? null,
		],
	});
}

/**
 * Estimate cost for a call based on stored pricing.
 */
async function estimateCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
): Promise<number | undefined> {
	const db = getDatabase();
	const result = await db.execute({
		sql: 'SELECT input_cost_per_1m, output_cost_per_1m FROM model_pricing WHERE model = ?',
		args: [model],
	});

	if (result.rows.length === 0) return undefined;

	const row = result.rows[0];
	const inputCost = ((row.input_cost_per_1m as number) / 1_000_000) * inputTokens;
	const outputCost = ((row.output_cost_per_1m as number) / 1_000_000) * outputTokens;
	return inputCost + outputCost;
}

/**
 * Query token usage with filters.
 */
export async function queryUsage(filters?: {
	squadId?: string;
	agentRole?: string;
	model?: string;
	since?: string; // ISO date
	until?: string; // ISO date
}): Promise<{
	records: Array<{
		model: string;
		inputTokens: number;
		outputTokens: number;
		estimatedCostUsd: number | null;
		timestamp: string;
		squadId: string | null;
		agentRole: string | null;
	}>;
	totals: {
		totalInputTokens: number;
		totalOutputTokens: number;
		totalCostUsd: number;
		callCount: number;
	};
}> {
	const db = getDatabase();
	const conditions: string[] = [];
	const args: (string | null)[] = [];

	if (filters?.squadId) {
		conditions.push('squad_id = ?');
		args.push(filters.squadId);
	}
	if (filters?.agentRole) {
		conditions.push('agent_role = ?');
		args.push(filters.agentRole);
	}
	if (filters?.model) {
		conditions.push('model = ?');
		args.push(filters.model);
	}
	if (filters?.since) {
		conditions.push('timestamp >= ?');
		args.push(filters.since);
	}
	if (filters?.until) {
		conditions.push('timestamp <= ?');
		args.push(filters.until);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	const result = await db.execute({
		sql: `SELECT model, input_tokens, output_tokens, estimated_cost_usd, timestamp, squad_id, agent_role
		      FROM token_usage ${where} ORDER BY timestamp DESC LIMIT 500`,
		args,
	});

	const records = result.rows.map((row) => ({
		model: row.model as string,
		inputTokens: row.input_tokens as number,
		outputTokens: row.output_tokens as number,
		estimatedCostUsd: row.estimated_cost_usd as number | null,
		timestamp: row.timestamp as string,
		squadId: row.squad_id as string | null,
		agentRole: row.agent_role as string | null,
	}));

	// Totals
	const totalsResult = await db.execute({
		sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(input_tokens), 0) as total_in,
		      COALESCE(SUM(output_tokens), 0) as total_out, COALESCE(SUM(estimated_cost_usd), 0) as total_cost
		      FROM token_usage ${where}`,
		args,
	});

	const totalsRow = totalsResult.rows[0];
	const totals = {
		callCount: (totalsRow?.cnt as number) ?? 0,
		totalInputTokens: (totalsRow?.total_in as number) ?? 0,
		totalOutputTokens: (totalsRow?.total_out as number) ?? 0,
		totalCostUsd: (totalsRow?.total_cost as number) ?? 0,
	};

	return { records, totals };
}
