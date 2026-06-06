import {
	type DatabaseClient,
	asNullableNumber,
	asNumber,
	asString,
	getDatabase,
	nowIso,
} from "../store/db.js";
import { fetchModelCatalog } from "./catalog.js";
import { scrapePremiumRequestPricing, scrapeTokenUnitPricing } from "./pricing-scraper.js";
import { SEED_MODELS } from "./seed.js";
import {
	type ModelPricing,
	type ModelTier,
	type PricingRefreshResult,
	TOKEN_UNIT_PRICE,
	computeTierFromMultiplier,
} from "./types.js";

/** Normalize model names for fuzzy matching between different sources */
function normalizeModelName(name: string): string {
	return name
		.toLowerCase()
		.replace(/^openai\s+/i, "")
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9.\-]/g, "")
		.trim();
}

type ModelMap = Map<string, Partial<ModelPricing> & { id: string; displayName: string }>;

interface RefreshLogger {
	warn: (msg: string) => void;
}

async function fetchCatalogIntoMap(
	modelMap: ModelMap,
	result: PricingRefreshResult,
	logger?: RefreshLogger,
): Promise<void> {
	try {
		const catalogModels = await fetchModelCatalog();
		result.catalogFetched = true;
		for (const m of catalogModels) {
			const key = normalizeModelName(m.id);
			modelMap.set(key, { id: m.id, displayName: m.displayName, available: true });
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		result.errors.push(`Catalog fetch failed: ${msg}`);
		logger?.warn(`Model catalog fetch failed: ${msg}`);
	}
}

async function scrapeTokenPricingIntoMap(
	modelMap: ModelMap,
	result: PricingRefreshResult,
	logger?: RefreshLogger,
): Promise<void> {
	try {
		const tokenPricing = await scrapeTokenUnitPricing();
		result.tokenPricingScraped = true;
		for (const tp of tokenPricing) {
			const key = normalizeModelName(tp.modelName);
			const existing = modelMap.get(key) ?? findClosestKey(modelMap, key);
			if (existing) {
				existing.tokenInputMultiplier = tp.inputMultiplier;
				existing.tokenOutputMultiplier = tp.outputMultiplier;
				existing.cachedInputMultiplier = tp.cachedInputMultiplier;
			} else {
				modelMap.set(key, {
					id: key,
					displayName: tp.modelName,
					tokenInputMultiplier: tp.inputMultiplier,
					tokenOutputMultiplier: tp.outputMultiplier,
					cachedInputMultiplier: tp.cachedInputMultiplier,
					available: true,
				});
			}
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		result.errors.push(`Token pricing scrape failed: ${msg}`);
		logger?.warn(`Token pricing scrape failed: ${msg}`);
	}
}

async function scrapePremiumPricingIntoMap(
	modelMap: ModelMap,
	result: PricingRefreshResult,
	logger?: RefreshLogger,
): Promise<void> {
	try {
		const premiumPricing = await scrapePremiumRequestPricing();
		result.premiumPricingScraped = true;
		for (const pp of premiumPricing) {
			const key = normalizeModelName(pp.modelName);
			const existing = modelMap.get(key) ?? findClosestKey(modelMap, key);
			if (existing) {
				existing.premiumMultiplier = pp.multiplier;
			} else {
				modelMap.set(key, {
					id: key,
					displayName: pp.modelName,
					premiumMultiplier: pp.multiplier,
					available: true,
				});
			}
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		result.errors.push(`Premium pricing scrape failed: ${msg}`);
		logger?.warn(`Premium pricing scrape failed: ${msg}`);
	}
}

/**
 * Attempt a full refresh: catalog API + page scrapes + merge into DB.
 * Returns a summary of what succeeded/failed.
 */
export async function refreshModelPricing(logger?: RefreshLogger): Promise<PricingRefreshResult> {
	const result: PricingRefreshResult = {
		modelsUpdated: 0,
		catalogFetched: false,
		tokenPricingScraped: false,
		premiumPricingScraped: false,
		errors: [],
	};

	const modelMap: ModelMap = new Map();

	await fetchCatalogIntoMap(modelMap, result, logger);
	await scrapeTokenPricingIntoMap(modelMap, result, logger);
	await scrapePremiumPricingIntoMap(modelMap, result, logger);

	// If nothing succeeded, seed with fallback data
	if (!result.catalogFetched && !result.tokenPricingScraped && !result.premiumPricingScraped) {
		logger?.warn("All pricing sources failed, using seed data");
		await seedFromFallback();
		result.modelsUpdated = SEED_MODELS.length;
		return result;
	}

	// Compute tiers and upsert into DB
	const db = await getDatabase();
	const now = nowIso();

	for (const model of modelMap.values()) {
		const tier = computeTierFromMultiplier(model.premiumMultiplier ?? null);
		await upsertModel(db, {
			id: model.id,
			displayName: model.displayName,
			premiumMultiplier: model.premiumMultiplier ?? null,
			tokenInputMultiplier: model.tokenInputMultiplier ?? null,
			tokenOutputMultiplier: model.tokenOutputMultiplier ?? null,
			cachedInputMultiplier: model.cachedInputMultiplier ?? null,
			tier,
			available: model.available ?? true,
			updatedAt: now,
		});
		result.modelsUpdated++;
	}

	return result;
}

/** Populate the model_pricing table with hardcoded seed data */
export async function seedFromFallback(): Promise<void> {
	const db = await getDatabase();
	const now = nowIso();

	for (const model of SEED_MODELS) {
		await upsertModel(db, { ...model, updatedAt: now });
	}
}

/** Get all models in a given tier, sorted by cheapest premium multiplier first */
export async function getModelsForTier(tier: ModelTier): Promise<ModelPricing[]> {
	const db = await getDatabase();
	const result = await db.execute({
		sql: "SELECT * FROM model_pricing WHERE tier = ? AND available = 1 ORDER BY premium_multiplier ASC NULLS LAST",
		args: [tier],
	});

	return result.rows.map(rowToModelPricing);
}

/** Get the cheapest available model in a tier */
export async function getCheapestInTier(tier: ModelTier): Promise<ModelPricing | null> {
	const models = await getModelsForTier(tier);
	return models[0] ?? null;
}

/** Get pricing for a specific model by ID */
export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
	const db = await getDatabase();
	const result = await db.execute({
		sql: "SELECT * FROM model_pricing WHERE id = ?",
		args: [modelId],
	});

	if (result.rows.length > 0) {
		return rowToModelPricing(result.rows[0]);
	}

	// Fuzzy fallback: model IDs from the SDK may include version suffixes
	// (e.g. "gpt-4o-2024-11-20") that don't match stored IDs ("gpt-4o")
	const allModels = await db.execute(
		"SELECT * FROM model_pricing WHERE token_input_multiplier IS NOT NULL ORDER BY length(id) DESC",
	);
	for (const row of allModels.rows) {
		const storedId = asString(row.id);
		if (modelId.startsWith(storedId) || storedId.startsWith(modelId)) {
			return rowToModelPricing(row);
		}
	}

	return null;
}

/** Get any available model in the cheapest tier (for classification calls) */
export async function getCheapestAvailableModel(): Promise<ModelPricing | null> {
	const tiers: ModelTier[] = ["trivial", "fast", "standard", "premium", "ultra"];

	for (const tier of tiers) {
		const model = await getCheapestInTier(tier);
		if (model) {
			return model;
		}
	}

	return null;
}

/** Calculate token-unit cost for a usage record */
export function calculateTokenUnitCost(
	inputTokens: number,
	outputTokens: number,
	inputMultiplier: number | null,
	outputMultiplier: number | null,
): number {
	if (inputMultiplier === null || outputMultiplier === null) {
		return 0;
	}

	const tokenUnits = inputTokens * inputMultiplier + outputTokens * outputMultiplier;
	return tokenUnits * TOKEN_UNIT_PRICE;
}

/** Get total model count */
export async function getModelCount(): Promise<number> {
	const db = await getDatabase();
	const result = await db.execute(
		"SELECT COUNT(*) as count FROM model_pricing WHERE available = 1",
	);
	return asNumber(result.rows[0].count);
}

/** Get the next tier up from a given tier */
export function getNextTierUp(tier: ModelTier): ModelTier | null {
	const order: ModelTier[] = ["trivial", "fast", "standard", "premium", "ultra"];
	const idx = order.indexOf(tier);
	if (idx < 0 || idx >= order.length - 1) {
		return null;
	}
	return order[idx + 1];
}

// --- Internal helpers ---

async function upsertModel(db: DatabaseClient, model: ModelPricing): Promise<void> {
	await db.execute({
		sql: `INSERT INTO model_pricing (id, display_name, premium_multiplier, token_input_multiplier, token_output_multiplier, cached_input_multiplier, tier, available, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				display_name = excluded.display_name,
				premium_multiplier = COALESCE(excluded.premium_multiplier, model_pricing.premium_multiplier),
				token_input_multiplier = COALESCE(excluded.token_input_multiplier, model_pricing.token_input_multiplier),
				token_output_multiplier = COALESCE(excluded.token_output_multiplier, model_pricing.token_output_multiplier),
				cached_input_multiplier = COALESCE(excluded.cached_input_multiplier, model_pricing.cached_input_multiplier),
				tier = excluded.tier,
				available = excluded.available,
				updated_at = excluded.updated_at`,
		args: [
			model.id,
			model.displayName,
			model.premiumMultiplier,
			model.tokenInputMultiplier,
			model.tokenOutputMultiplier,
			model.cachedInputMultiplier,
			model.tier,
			model.available ? 1 : 0,
			model.updatedAt,
		],
	});
}

function rowToModelPricing(row: Record<string, unknown>): ModelPricing {
	return {
		id: asString(row.id),
		displayName: asString(row.display_name),
		premiumMultiplier: asNullableNumber(row.premium_multiplier),
		tokenInputMultiplier: asNullableNumber(row.token_input_multiplier),
		tokenOutputMultiplier: asNullableNumber(row.token_output_multiplier),
		cachedInputMultiplier: asNullableNumber(row.cached_input_multiplier),
		tier: asString(row.tier) as ModelTier,
		available: asNumber(row.available) === 1,
		updatedAt: asString(row.updated_at),
	};
}

function findClosestKey(
	map: Map<string, Partial<ModelPricing> & { id: string; displayName: string }>,
	targetKey: string,
): (Partial<ModelPricing> & { id: string; displayName: string }) | undefined {
	// Try partial match (one contains the other)
	for (const [key, value] of map) {
		if (key.includes(targetKey) || targetKey.includes(key)) {
			return value;
		}
	}
	return undefined;
}
