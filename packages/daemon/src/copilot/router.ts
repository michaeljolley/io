import { FAST_MODEL, PREMIUM_MODEL, STANDARD_MODEL } from "@io/shared";

export type ModelTier = "fast" | "standard" | "premium";

export interface RouteDecision {
	requestedTier: ModelTier;
	effectiveTier: ModelTier;
	model: string;
	switched: boolean;
	cooldownRemaining: number;
}

const FAST_KEYWORDS = [
	"hi",
	"hello",
	"hey",
	"thanks",
	"thank you",
	"status",
	"list",
	"show",
	"ping",
	"uptime",
	"what time",
	"ok",
	"okay",
] as const;

const PREMIUM_KEYWORDS = [
	"architecture",
	"architect",
	"design",
	"tradeoff",
	"trade-off",
	"plan",
	"planning",
	"strategy",
	"roadmap",
	"migration",
	"refactor",
	"generate",
	"implement",
	"build",
	"codebase",
	"repository",
	"system prompt",
	"multi-step",
	"complex",
	"reason",
	"compare",
] as const;

const SIMPLE_QUESTION_PREFIXES = [
	"is",
	"are",
	"do",
	"does",
	"did",
	"can",
	"could",
	"should",
	"would",
	"will",
] as const;

const MODEL_SWITCH_COOLDOWN_MESSAGES = 3;

let activeTier: ModelTier | null = null;
let messagesSinceLastSwitch = MODEL_SWITCH_COOLDOWN_MESSAGES;

export function resetRouterState(): void {
	activeTier = null;
	messagesSinceLastSwitch = MODEL_SWITCH_COOLDOWN_MESSAGES;
}

function normalizeMessage(message: string): string {
	return message.trim().toLowerCase();
}

function getWordCount(message: string): number {
	const normalized = message.trim();
	if (normalized.length === 0) {
		return 0;
	}

	return normalized.split(/\s+/u).length;
}

function containsAny(message: string, keywords: readonly string[]): boolean {
	return keywords.some((keyword) => message.includes(keyword));
}

function startsWithSimpleQuestion(message: string): boolean {
	return SIMPLE_QUESTION_PREFIXES.some(
		(prefix) => message === prefix || message.startsWith(`${prefix} `),
	);
}

export function classifyMessage(message: string): ModelTier {
	const normalized = normalizeMessage(message);
	const wordCount = getWordCount(normalized);

	if (normalized.length === 0) {
		return "fast";
	}

	if (containsAny(normalized, PREMIUM_KEYWORDS) || normalized.includes("```") || wordCount >= 80) {
		return "premium";
	}

	if (
		wordCount <= 20 &&
		(containsAny(normalized, FAST_KEYWORDS) ||
			startsWithSimpleQuestion(normalized) ||
			/^(yes|no|sure|okay|ok|thanks)[!.?]*$/u.test(normalized))
	) {
		return "fast";
	}

	if (wordCount <= 8 && /^(what|when|where|who)\b/u.test(normalized)) {
		return "fast";
	}

	return "standard";
}

export function getModelForTier(tier: ModelTier): string {
	switch (tier) {
		case "fast":
			return FAST_MODEL;
		case "premium":
			return PREMIUM_MODEL;
		default:
			return STANDARD_MODEL;
	}
}

export function routeMessage(message: string): RouteDecision {
	const requestedTier = classifyMessage(message);

	if (activeTier === null) {
		activeTier = requestedTier;
		messagesSinceLastSwitch = 0;
		return {
			requestedTier,
			effectiveTier: activeTier,
			model: getModelForTier(activeTier),
			switched: true,
			cooldownRemaining: MODEL_SWITCH_COOLDOWN_MESSAGES,
		};
	}

	if (requestedTier !== activeTier && messagesSinceLastSwitch >= MODEL_SWITCH_COOLDOWN_MESSAGES) {
		activeTier = requestedTier;
		messagesSinceLastSwitch = 0;
		return {
			requestedTier,
			effectiveTier: activeTier,
			model: getModelForTier(activeTier),
			switched: true,
			cooldownRemaining: MODEL_SWITCH_COOLDOWN_MESSAGES,
		};
	}

	messagesSinceLastSwitch += 1;

	return {
		requestedTier,
		effectiveTier: activeTier,
		model: getModelForTier(activeTier),
		switched: false,
		cooldownRemaining: Math.max(MODEL_SWITCH_COOLDOWN_MESSAGES - messagesSinceLastSwitch, 0),
	};
}
