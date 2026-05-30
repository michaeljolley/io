import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from '../store/db.js';
import { MODEL_REGISTRY, type ModelInfo } from './registry.js';

const logger = () => createChildLogger('pricing');

/**
 * Default pricing estimates (USD per 1M tokens) when GitHub pricing is unavailable.
 * These are rough estimates based on publicly available pricing.
 */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
	'claude-haiku-4.5': { input: 0.8, output: 4.0 },
	'gpt-5-mini': { input: 1.5, output: 6.0 },
	'gpt-5.4-mini': { input: 1.5, output: 6.0 },
	'claude-sonnet-4.5': { input: 3.0, output: 15.0 },
	'claude-sonnet-4.6': { input: 3.0, output: 15.0 },
	'gpt-5.2': { input: 5.0, output: 15.0 },
	'gpt-5.4': { input: 5.0, output: 15.0 },
	'gpt-5.5': { input: 5.0, output: 15.0 },
	'gpt-4.1': { input: 2.0, output: 8.0 },
	'claude-opus-4.5': { input: 15.0, output: 75.0 },
	'claude-opus-4.6': { input: 15.0, output: 75.0 },
	'claude-opus-4.7': { input: 15.0, output: 75.0 },
	'claude-opus-4.8': { input: 15.0, output: 75.0 },
	'gpt-5.2-codex': { input: 10.0, output: 30.0 },
	'gpt-5.3-codex': { input: 10.0, output: 30.0 },
};

/**
 * Seed the model_pricing table with default values.
 * Only inserts if the table is empty.
 */
export async function seedPricing(): Promise<void> {
	const log = logger();
	const db = getDatabase();

	const existing = await db.execute('SELECT COUNT(*) as cnt FROM model_pricing');
	if ((existing.rows[0]?.cnt as number) > 0) {
		return; // Already seeded
	}

	for (const [model, prices] of Object.entries(DEFAULT_PRICING)) {
		const info = MODEL_REGISTRY.find((m) => m.id === model);
		await db.execute({
			sql: `INSERT OR REPLACE INTO model_pricing (model, input_cost_per_1m, output_cost_per_1m, tier, last_updated)
			      VALUES (?, ?, ?, ?, datetime('now'))`,
			args: [model, prices.input, prices.output, info?.tier ?? 'standard'],
		});
	}

	log.info('Model pricing seeded with defaults');
}

/**
 * Update pricing for a specific model.
 */
export async function updatePricing(
	model: string,
	inputCostPer1M: number,
	outputCostPer1M: number,
): Promise<void> {
	const db = getDatabase();
	const info = MODEL_REGISTRY.find((m) => m.id === model);

	await db.execute({
		sql: `INSERT OR REPLACE INTO model_pricing (model, input_cost_per_1m, output_cost_per_1m, tier, last_updated)
		      VALUES (?, ?, ?, ?, datetime('now'))`,
		args: [model, inputCostPer1M, outputCostPer1M, info?.tier ?? 'standard'],
	});
}

/**
 * Get all current pricing.
 */
export async function getAllPricing(): Promise<
	Array<{
		model: string;
		inputCostPer1M: number;
		outputCostPer1M: number;
		tier: string;
		lastUpdated: string;
	}>
> {
	const db = getDatabase();
	const result = await db.execute('SELECT * FROM model_pricing ORDER BY model');

	return result.rows.map((row) => ({
		model: row.model as string,
		inputCostPer1M: row.input_cost_per_1m as number,
		outputCostPer1M: row.output_cost_per_1m as number,
		tier: (row.tier as string) ?? 'standard',
		lastUpdated: row.last_updated as string,
	}));
}

/**
 * Refresh pricing — in future this could fetch from GitHub docs.
 * For now, re-seeds defaults for any missing models.
 */
export async function refreshPricing(): Promise<void> {
	const log = logger();
	const db = getDatabase();

	for (const [model, prices] of Object.entries(DEFAULT_PRICING)) {
		const existing = await db.execute({
			sql: 'SELECT model FROM model_pricing WHERE model = ?',
			args: [model],
		});

		if (existing.rows.length === 0) {
			const info = MODEL_REGISTRY.find((m) => m.id === model);
			await db.execute({
				sql: `INSERT INTO model_pricing (model, input_cost_per_1m, output_cost_per_1m, tier, last_updated)
				      VALUES (?, ?, ?, ?, datetime('now'))`,
				args: [model, prices.input, prices.output, info?.tier ?? 'standard'],
			});
		}
	}

	log.info('Pricing refreshed');
}
