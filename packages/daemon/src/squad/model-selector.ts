import { FAST_MODEL, PREMIUM_MODEL, STANDARD_MODEL } from "@io/shared";

const SIMPLE_KEYWORDS = [
	"rename",
	"typo",
	"spelling",
	"copy change",
	"config",
	"configuration",
	"lint",
	"format",
	"documentation",
	"readme",
	"comment",
	"small fix",
	"minor",
];

const COMPLEX_KEYWORDS = [
	"refactor",
	"architecture",
	"pipeline",
	"orchestr",
	"multi-file",
	"cross-cutting",
	"migration",
	"performance",
	"security",
	"concurrency",
	"parallel",
	"worktree",
	"design",
	"planning",
	"system",
	"integration",
];

function normalize(text: string): string {
	return text.trim().toLowerCase();
}

function pickAvailableModel(preferred: string, availableModels?: string[]): string {
	if (!availableModels || availableModels.length === 0) {
		return preferred;
	}

	if (availableModels.includes(preferred)) {
		return preferred;
	}

	if (preferred === PREMIUM_MODEL && availableModels.includes(STANDARD_MODEL)) {
		return STANDARD_MODEL;
	}

	if (preferred === FAST_MODEL && availableModels.includes(STANDARD_MODEL)) {
		return STANDARD_MODEL;
	}

	if (availableModels.includes(PREMIUM_MODEL)) {
		return PREMIUM_MODEL;
	}

	if (availableModels.includes(STANDARD_MODEL)) {
		return STANDARD_MODEL;
	}

	if (availableModels.includes(FAST_MODEL)) {
		return FAST_MODEL;
	}

	return availableModels[0] ?? preferred;
}

export async function selectModelForTask(
	taskDescription: string,
	availableModels?: string[],
): Promise<string> {
	const normalized = normalize(taskDescription);

	const isComplex = COMPLEX_KEYWORDS.some((keyword) => normalized.includes(keyword));
	const isSimple = SIMPLE_KEYWORDS.some((keyword) => normalized.includes(keyword));

	let preferred = STANDARD_MODEL;

	if (isComplex) {
		preferred = PREMIUM_MODEL;
	} else if (isSimple) {
		preferred = FAST_MODEL;
	}

	return pickAvailableModel(preferred, availableModels);
}
