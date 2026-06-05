import type { Squad } from "@io/shared";

export interface SystemPromptOptions {
	squads: Squad[];
	wikiContext: string;
	skillsContext: string;
	conversationSummary?: string;
}

function formatSquadRoster(squads: Squad[]): string {
	if (squads.length === 0) {
		return "- No squads are currently hired.";
	}

	return squads
		.map(
			(squad) =>
				`- ${squad.name} — ${squad.repoOwner}/${squad.repoName} (${squad.status}) [id=${squad.id}]`,
		)
		.join("\n");
}

function formatOptionalSection(title: string, content: string): string {
	const normalized = content.trim();
	return `${title}\n${normalized.length > 0 ? normalized : "None."}`;
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
	const sections = [
		"You are Io, a helpful AI orchestrator companion for IO v4.",
		"You coordinate work across squads, wiki knowledge, installed skills, and direct execution tools.",
		"When a user asks about a project that has a squad, delegate to that squad. When no squad exists, you can do the work directly.",
		"Be practical, concise, and execution-oriented. Use tools when they help you produce a more accurate or durable result.",
		"## Delegation Rules\n- Prefer delegation for project-specific work when a matching squad exists.\n- If no squad exists for the target repository or project, use direct coding and knowledge tools yourself.\n- Use the wiki to remember important information and recover prior context.\n- Use installed skills when they are relevant to the current request.",
		`## Squad Roster\n${formatSquadRoster(options.squads)}`,
		formatOptionalSection("## Conversation Summary", options.conversationSummary ?? ""),
		formatOptionalSection("## Wiki Context", options.wikiContext),
		formatOptionalSection("## Active Skills", options.skillsContext),
		"## Response Guidelines\n- State when you are delegating versus acting directly.\n- Keep the user informed of material actions and outcomes.\n- If a tool fails, explain the failure briefly and continue with the best available path.",
	];

	return sections.join("\n\n").trim();
}
