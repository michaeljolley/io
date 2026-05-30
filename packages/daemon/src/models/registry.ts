/**
 * Model registry — defines available models, tiers, and selection logic.
 * Models are sourced from the GitHub Copilot SDK's available model list.
 */

export type ModelTier = 'fast' | 'standard' | 'reasoning';

export interface ModelInfo {
	id: string;
	tier: ModelTier;
	description: string;
	maxContext: number; // approximate token window
	inputCostPer1M?: number; // USD per 1M input tokens
	outputCostPer1M?: number; // USD per 1M output tokens
}

/**
 * Known models available via GitHub Copilot SDK (as of 2026-05).
 */
export const MODEL_REGISTRY: ModelInfo[] = [
	// Fast tier — low-latency, cost-effective
	{
		id: 'claude-haiku-4.5',
		tier: 'fast',
		description: 'Claude Haiku 4.5 — fast, cheap',
		maxContext: 200_000,
	},
	{
		id: 'gpt-5-mini',
		tier: 'fast',
		description: 'GPT-5 Mini — fast responses',
		maxContext: 128_000,
	},
	{
		id: 'gpt-5.4-mini',
		tier: 'fast',
		description: 'GPT-5.4 Mini — fast, latest',
		maxContext: 128_000,
	},

	// Standard tier — balanced capability/cost
	{
		id: 'claude-sonnet-4.5',
		tier: 'standard',
		description: 'Claude Sonnet 4.5',
		maxContext: 200_000,
	},
	{
		id: 'claude-sonnet-4.6',
		tier: 'standard',
		description: 'Claude Sonnet 4.6',
		maxContext: 200_000,
	},
	{ id: 'gpt-5.2', tier: 'standard', description: 'GPT-5.2', maxContext: 128_000 },
	{ id: 'gpt-5.4', tier: 'standard', description: 'GPT-5.4', maxContext: 128_000 },
	{
		id: 'gpt-5.5',
		tier: 'standard',
		description: 'GPT-5.5 — latest standard',
		maxContext: 128_000,
	},
	{
		id: 'gpt-4.1',
		tier: 'standard',
		description: 'GPT-4.1 — legacy standard',
		maxContext: 128_000,
	},

	// Reasoning tier — highest capability, most expensive
	{ id: 'claude-opus-4.5', tier: 'reasoning', description: 'Claude Opus 4.5', maxContext: 200_000 },
	{ id: 'claude-opus-4.6', tier: 'reasoning', description: 'Claude Opus 4.6', maxContext: 200_000 },
	{ id: 'claude-opus-4.7', tier: 'reasoning', description: 'Claude Opus 4.7', maxContext: 200_000 },
	{
		id: 'claude-opus-4.8',
		tier: 'reasoning',
		description: 'Claude Opus 4.8 — latest',
		maxContext: 200_000,
	},
	{
		id: 'gpt-5.2-codex',
		tier: 'reasoning',
		description: 'GPT-5.2 Codex — code-focused reasoning',
		maxContext: 128_000,
	},
	{
		id: 'gpt-5.3-codex',
		tier: 'reasoning',
		description: 'GPT-5.3 Codex — code reasoning',
		maxContext: 128_000,
	},
];

/** Get all models in a tier */
export function getModelsByTier(tier: ModelTier): ModelInfo[] {
	return MODEL_REGISTRY.filter((m) => m.tier === tier);
}

/** Get a specific model by ID */
export function getModel(modelId: string): ModelInfo | undefined {
	return MODEL_REGISTRY.find((m) => m.id === modelId);
}

/** Default model per tier */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
	fast: 'gpt-5.4-mini',
	standard: 'claude-sonnet-4.6',
	reasoning: 'claude-opus-4.6',
};

/**
 * Select the appropriate model tier for a task based on complexity.
 * Used by team leads to choose models for agent task execution.
 */
export function selectModelForTask(params: {
	taskDescription: string;
	isCodeGeneration?: boolean;
	requiresReasoning?: boolean;
	preferFast?: boolean;
}): string {
	if (params.preferFast) {
		return DEFAULT_MODELS.fast;
	}
	if (params.requiresReasoning) {
		return params.isCodeGeneration ? 'gpt-5.3-codex' : DEFAULT_MODELS.reasoning;
	}
	if (params.isCodeGeneration) {
		return DEFAULT_MODELS.standard;
	}
	// Default: standard tier
	return DEFAULT_MODELS.standard;
}
