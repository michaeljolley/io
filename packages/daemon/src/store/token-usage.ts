import type { UsageQueryParams, UsageSummary } from "@io/shared";
import type { TokenUsage } from "@io/shared";
import {
	type DatabaseClient,
	asNullableString,
	asNumber,
	asString,
	generateId,
	getDatabase,
	nowIso,
} from "./db.js";

interface QueryFilter {
	clause: string;
	args: Array<string | number>;
}

export interface RecordUsageInput {
	squadId?: string | null;
	agentId?: string | null;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
	createdAt?: string;
}

export interface UsageModelBreakdown {
	model: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
}

export interface DailyUsagePoint {
	date: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
}

export interface UsageAggregate {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCost: number;
	byModel: UsageModelBreakdown[];
	daily: DailyUsagePoint[];
}

export interface SquadUsageAggregate extends UsageAggregate {
	squadId: string;
}

export interface AgentUsageAggregate extends UsageAggregate {
	agentId: string;
	squadId: string | null;
}

export async function recordUsage(
	data: RecordUsageInput,
	db?: DatabaseClient,
): Promise<TokenUsage> {
	const database = db ?? (await getDatabase());
	const usage: TokenUsage = {
		id: generateId(),
		squadId: data.squadId ?? null,
		agentId: data.agentId ?? null,
		model: data.model,
		inputTokens: data.inputTokens,
		outputTokens: data.outputTokens,
		cost: data.cost,
		createdAt: data.createdAt ?? nowIso(),
	};

	await database.execute({
		sql: `INSERT INTO token_usage (id, squad_id, agent_id, model, input_tokens, output_tokens, cost, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			usage.id,
			usage.squadId,
			usage.agentId,
			usage.model,
			usage.inputTokens,
			usage.outputTokens,
			usage.cost,
			usage.createdAt,
		],
	});

	return usage;
}

export async function getUsageSummary(
	params: UsageQueryParams = {},
	db?: DatabaseClient,
): Promise<UsageSummary> {
	const database = db ?? (await getDatabase());
	const filter = buildUsageFilter(params);
	const [totalsResult, bySquadResult, byAgentResult, byModelResult, daily] = await Promise.all([
		database.execute({
			sql: `SELECT COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
			             COALESCE(SUM(cost), 0) AS total_cost
			      FROM token_usage ${filter.clause}`,
			args: filter.args,
		}),
		database.execute({
			sql: `SELECT tu.squad_id,
			             COALESCE(s.name, tu.squad_id, 'Unknown squad') AS squad_name,
			             COALESCE(SUM(tu.input_tokens), 0) AS input_tokens,
			             COALESCE(SUM(tu.output_tokens), 0) AS output_tokens,
			             COALESCE(SUM(tu.cost), 0) AS cost
			      FROM token_usage tu
			      LEFT JOIN squads s ON s.id = tu.squad_id
			      ${filter.clause.replaceAll("created_at", "tu.created_at").replaceAll("squad_id", "tu.squad_id").replaceAll("agent_id", "tu.agent_id").replaceAll("model", "tu.model")}
			      AND tu.squad_id IS NOT NULL
			      GROUP BY tu.squad_id, squad_name
			      ORDER BY cost DESC, input_tokens DESC`,
			args: filter.args,
		}),
		database.execute({
			sql: `SELECT tu.agent_id,
			             COALESCE(sm.name, tu.agent_id, 'Unknown agent') AS agent_name,
			             COALESCE(tu.squad_id, '') AS squad_id,
			             COALESCE(SUM(tu.input_tokens), 0) AS input_tokens,
			             COALESCE(SUM(tu.output_tokens), 0) AS output_tokens,
			             COALESCE(SUM(tu.cost), 0) AS cost
			      FROM token_usage tu
			      LEFT JOIN squad_members sm ON sm.id = tu.agent_id
			      ${filter.clause.replaceAll("created_at", "tu.created_at").replaceAll("squad_id", "tu.squad_id").replaceAll("agent_id", "tu.agent_id").replaceAll("model", "tu.model")}
			      AND tu.agent_id IS NOT NULL
			      GROUP BY tu.agent_id, agent_name, tu.squad_id
			      ORDER BY cost DESC, input_tokens DESC`,
			args: filter.args,
		}),
		database.execute({
			sql: `SELECT model,
			             COALESCE(SUM(input_tokens), 0) AS input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS output_tokens,
			             COALESCE(SUM(cost), 0) AS cost
			      FROM token_usage ${filter.clause}
			      GROUP BY model
			      ORDER BY cost DESC, input_tokens DESC`,
			args: filter.args,
		}),
		getDailyUsage(params.startDate ?? null, params.endDate ?? null, params, database),
	]);
	const totals = totalsResult.rows[0];

	return {
		totalInputTokens: totals ? asNumber(totals.total_input_tokens) : 0,
		totalOutputTokens: totals ? asNumber(totals.total_output_tokens) : 0,
		totalCost: totals ? asNumber(totals.total_cost) : 0,
		bySquad: bySquadResult.rows.map((row) => ({
			squadId: asString(row.squad_id),
			squadName: asString(row.squad_name),
			inputTokens: asNumber(row.input_tokens),
			outputTokens: asNumber(row.output_tokens),
			cost: asNumber(row.cost),
		})),
		byAgent: byAgentResult.rows.map((row) => ({
			agentId: asString(row.agent_id),
			agentName: asString(row.agent_name),
			squadId: asString(row.squad_id),
			inputTokens: asNumber(row.input_tokens),
			outputTokens: asNumber(row.output_tokens),
			cost: asNumber(row.cost),
		})),
		byModel: byModelResult.rows.map((row) => ({
			model: asString(row.model),
			inputTokens: asNumber(row.input_tokens),
			outputTokens: asNumber(row.output_tokens),
			cost: asNumber(row.cost),
		})),
		daily,
	};
}

export async function getUsageBySquad(
	squadId: string,
	startDate?: string,
	endDate?: string,
	db?: DatabaseClient,
): Promise<SquadUsageAggregate> {
	const database = db ?? (await getDatabase());
	const baseFilter = buildUsageFilter({ squadId, startDate, endDate });
	const [totalsResult, byModelResult, daily] = await Promise.all([
		database.execute({
			sql: `SELECT COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
			             COALESCE(SUM(cost), 0) AS total_cost
			      FROM token_usage ${baseFilter.clause}`,
			args: baseFilter.args,
		}),
		database.execute({
			sql: `SELECT model,
			             COALESCE(SUM(input_tokens), 0) AS input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS output_tokens,
			             COALESCE(SUM(cost), 0) AS cost
			      FROM token_usage ${baseFilter.clause}
			      GROUP BY model
			      ORDER BY cost DESC, input_tokens DESC`,
			args: baseFilter.args,
		}),
		getDailyUsage(startDate ?? null, endDate ?? null, { squadId }, database),
	]);
	const totals = totalsResult.rows[0];

	return {
		squadId,
		totalInputTokens: totals ? asNumber(totals.total_input_tokens) : 0,
		totalOutputTokens: totals ? asNumber(totals.total_output_tokens) : 0,
		totalCost: totals ? asNumber(totals.total_cost) : 0,
		byModel: byModelResult.rows.map((row) => ({
			model: asString(row.model),
			inputTokens: asNumber(row.input_tokens),
			outputTokens: asNumber(row.output_tokens),
			cost: asNumber(row.cost),
		})),
		daily,
	};
}

export async function getUsageByAgent(
	agentId: string,
	startDate?: string,
	endDate?: string,
	db?: DatabaseClient,
): Promise<AgentUsageAggregate> {
	const database = db ?? (await getDatabase());
	const baseFilter = buildUsageFilter({ agentId, startDate, endDate });
	const [totalsResult, squadResult, byModelResult, daily] = await Promise.all([
		database.execute({
			sql: `SELECT COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
			             COALESCE(SUM(cost), 0) AS total_cost
			      FROM token_usage ${baseFilter.clause}`,
			args: baseFilter.args,
		}),
		database.execute({
			sql: `SELECT squad_id FROM token_usage ${baseFilter.clause} AND squad_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
			args: baseFilter.args,
		}),
		database.execute({
			sql: `SELECT model,
			             COALESCE(SUM(input_tokens), 0) AS input_tokens,
			             COALESCE(SUM(output_tokens), 0) AS output_tokens,
			             COALESCE(SUM(cost), 0) AS cost
			      FROM token_usage ${baseFilter.clause}
			      GROUP BY model
			      ORDER BY cost DESC, input_tokens DESC`,
			args: baseFilter.args,
		}),
		getDailyUsage(startDate ?? null, endDate ?? null, { agentId }, database),
	]);
	const totals = totalsResult.rows[0];

	return {
		agentId,
		squadId: squadResult.rows[0] ? asNullableString(squadResult.rows[0].squad_id) : null,
		totalInputTokens: totals ? asNumber(totals.total_input_tokens) : 0,
		totalOutputTokens: totals ? asNumber(totals.total_output_tokens) : 0,
		totalCost: totals ? asNumber(totals.total_cost) : 0,
		byModel: byModelResult.rows.map((row) => ({
			model: asString(row.model),
			inputTokens: asNumber(row.input_tokens),
			outputTokens: asNumber(row.output_tokens),
			cost: asNumber(row.cost),
		})),
		daily,
	};
}

export async function getDailyUsage(
	startDate: string | null,
	endDate: string | null,
	params: Pick<UsageQueryParams, "squadId" | "agentId" | "model"> = {},
	db?: DatabaseClient,
): Promise<DailyUsagePoint[]> {
	const database = db ?? (await getDatabase());
	const filter = buildUsageFilter({
		...params,
		startDate: startDate ?? undefined,
		endDate: endDate ?? undefined,
	});
	const result = await database.execute({
		sql: `SELECT substr(created_at, 1, 10) AS usage_date,
		             COALESCE(SUM(input_tokens), 0) AS input_tokens,
		             COALESCE(SUM(output_tokens), 0) AS output_tokens,
		             COALESCE(SUM(cost), 0) AS cost
		      FROM token_usage ${filter.clause}
		      GROUP BY usage_date
		      ORDER BY usage_date ASC`,
		args: filter.args,
	});

	return result.rows.map((row) => ({
		date: asString(row.usage_date),
		inputTokens: asNumber(row.input_tokens),
		outputTokens: asNumber(row.output_tokens),
		cost: asNumber(row.cost),
	}));
}

function buildUsageFilter(params: UsageQueryParams): QueryFilter {
	const conditions: string[] = ["WHERE 1 = 1"];
	const args: Array<string | number> = [];

	if (params.startDate) {
		conditions.push("AND created_at >= ?");
		args.push(params.startDate);
	}

	if (params.endDate) {
		conditions.push("AND created_at <= ?");
		args.push(params.endDate);
	}

	if (params.squadId) {
		conditions.push("AND squad_id = ?");
		args.push(params.squadId);
	}

	if (params.agentId) {
		conditions.push("AND agent_id = ?");
		args.push(params.agentId);
	}

	if (params.model) {
		conditions.push("AND model = ?");
		args.push(params.model);
	}

	return {
		clause: conditions.join(" "),
		args,
	};
}
