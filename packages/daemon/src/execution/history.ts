import { appendHistory, getAgentHistory } from "../store/index.js";

const DEFAULT_CONTEXT_LIMIT = 5;
const MAX_LEARNING_LENGTH = 1_000;

function summarizeTaskResult(taskResult: string): string {
	const condensed = taskResult.replace(/\s+/g, " ").trim();
	if (condensed.length <= MAX_LEARNING_LENGTH) {
		return condensed;
	}

	return `${condensed.slice(0, MAX_LEARNING_LENGTH - 3)}...`;
}

export async function extractLearnings(
	agentId: string,
	squadId: string,
	taskResult: string,
): Promise<string> {
	const summary = summarizeTaskResult(taskResult);
	await appendHistory(agentId, squadId, summary);
	return summary;
}

export async function getContextForAgent(
	agentId: string,
	limit = DEFAULT_CONTEXT_LIMIT,
): Promise<string> {
	const entries = await getAgentHistory(agentId, limit);
	if (entries.length === 0) {
		return "No prior task history is available for this agent.";
	}

	const orderedEntries = [...entries].reverse();
	return orderedEntries
		.map((entry, index) => `- Learning ${index + 1}: ${entry.content}`)
		.join("\n");
}
