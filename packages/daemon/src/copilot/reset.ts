const DEFAULT_SUMMARY_WINDOW = 12;
const MAX_SUMMARY_MESSAGE_LENGTH = 280;

export interface ResetMessage {
	role: string;
	content: string;
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/gu, " ").trim();
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

function formatRole(role: string): string {
	const normalizedRole = normalizeWhitespace(role).toLowerCase();
	return normalizedRole.length > 0 ? normalizedRole.toUpperCase() : "UNKNOWN";
}

export function shouldReset(messageCount: number, threshold: number): boolean {
	if (!Number.isFinite(messageCount) || !Number.isFinite(threshold) || threshold <= 0) {
		return false;
	}

	return messageCount >= threshold;
}

export function createResetSummary(messages: ResetMessage[]): string {
	const recentMessages = messages
		.filter((message) => normalizeWhitespace(message.content).length > 0)
		.slice(-DEFAULT_SUMMARY_WINDOW);

	if (recentMessages.length === 0) {
		return "Conversation summary: no prior messages were available. Continue with a clean context.";
	}

	const transcript = recentMessages.map((message, index) => {
		const content = truncate(normalizeWhitespace(message.content), MAX_SUMMARY_MESSAGE_LENGTH);
		return `${index + 1}. ${formatRole(message.role)}: ${content}`;
	});

	const latestUserMessages = recentMessages
		.filter((message) => normalizeWhitespace(message.role).toLowerCase() === "user")
		.slice(-3)
		.map((message) => `- ${truncate(normalizeWhitespace(message.content), 160)}`);

	const activeFocus =
		latestUserMessages.length > 0
			? latestUserMessages.join("\n")
			: "- No recent user asks captured.";

	return [
		"Conversation summary for a fresh Copilot session:",
		`- Total messages summarized: ${recentMessages.length}`,
		"- Preserve decisions, unresolved work, and user intent from the transcript below.",
		"- Most recent user focus:",
		activeFocus,
		"- Transcript excerpt:",
		...transcript,
	].join("\n");
}

export function buildFreshSessionContext(summary: string, wikiContext: string): string {
	const normalizedSummary = summary.trim();
	const normalizedWikiContext = wikiContext.trim();
	const sections = [
		"Use the following carried-over context when continuing the conversation.",
		"<conversation_summary>",
		normalizedSummary.length > 0
			? normalizedSummary
			: "No prior conversation summary was available.",
		"</conversation_summary>",
	];

	if (normalizedWikiContext.length > 0) {
		sections.push("<wiki_context>", normalizedWikiContext, "</wiki_context>");
	}

	sections.push(
		"Continue from this context without restating the summary unless the user asks for it.",
	);
	return sections.join("\n\n");
}
