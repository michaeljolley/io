import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { selectModel } from "./model-router.js";
import { createSquadTools } from "./squad-tools.js";
import { loadSkillDirectories, loadSquadSkillDirectories } from "./skills.js";
import { getMcpServersForSession } from "../mcp/registry.js";
import { logWarn } from "../logging.js";
import { addAuditEntry } from "../store/audit-log.js";
import { PATHS } from "../paths.js";

/**
 * Run the Scribe — a background agent that merges decisions from the inbox
 * into the canonical decisions.md and writes a session log.
 *
 * Fire-and-forget: errors are logged but never propagated to callers.
 */
export async function runScribe(options: {
	squadId: string;
	squadSlug: string;
	workDir: string;
	taskSummary: string;
	agentName: string;
	taskId: string;
}): Promise<void> {
	const { squadId, squadSlug, workDir, taskSummary, agentName, taskId } = options;

	// Ensure decisions structure exists (supports pre-existing squads)
	ensureDecisionsStructure(squadSlug);

	try {
		const model = await selectModel("low");
		const client = await getClient();

		const squadTools = createSquadTools(squadSlug, squadId, workDir);
		const skillDirs = [
			...(await loadSkillDirectories()),
			...loadSquadSkillDirectories(squadSlug),
		];
		const mcpServers = getMcpServersForSession();

		const systemMessage = buildScribeSystemMessage(squadSlug);

		const session = await client.createSession({
			model,
			streaming: true,
			workingDirectory: workDir,
			systemMessage: { mode: "replace" as const, content: systemMessage },
			tools: squadTools,
			skillDirectories: skillDirs,
			mcpServers,
			onPermissionRequest: approveAll,
		});

		try {
			const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
			const prompt = `A task has just been completed. Process the decision inbox and write a session log.

## Task Details
- **Completed by:** ${agentName}
- **Task ID:** ${taskId}
- **Timestamp:** ${new Date().toISOString()}
- **Summary:** ${taskSummary.slice(0, 2000)}

## Your Tasks (in order):

1. **Read decisions/inbox**: Use \`wiki_list\` to find all files under \`decisions/inbox/\`. For each file found, use \`wiki_read\` to get its content.

2. **Merge into decisions.md**: Read the current \`decisions.md\`. Append any new decisions from the inbox files. Deduplicate — if the same decision already exists, skip it. Each entry should have a timestamp, author, and brief description.

3. **Clean inbox**: Delete each processed inbox file with \`wiki_delete\`.

4. **Write session log**: Write a brief log entry to \`log/${now}-session.md\` with:
   - Who worked (${agentName})
   - What was accomplished (brief summary)
   - Decisions made (list from inbox, or "none")

5. **Archival check**: If \`decisions.md\` is very large (over ~50 entries), summarize and remove the oldest entries to keep it focused on recent/relevant decisions.

If the inbox is empty and there's nothing to log, you may skip steps 1-3 and just write the session log.`;

			await session.sendAndWait({ prompt }, 120_000);
		} finally {
			await session.disconnect();
		}

		addAuditEntry(
			"scribe_completed",
			`Scribe processed decisions for squad ${squadSlug}`,
			{ taskId, agentName },
			{ squad_id: squadId },
		);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		logWarn("Scribe failed (non-fatal)", { squadId, squadSlug, taskId }, err);
		addAuditEntry(
			"scribe_failed",
			`Scribe failed: ${errMsg.slice(0, 200)}`,
			{ error: errMsg, taskId },
			{ squad_id: squadId },
		);
	}
}

function buildScribeSystemMessage(squadSlug: string): string {
	return `# Scribe — Session Logger & Decision Merger

## Identity
- **Role:** Silent background memory manager for the squad
- **Style:** You are invisible. You never speak to users. You only read and write wiki pages.

## Your Job
You maintain the squad's shared memory by:
1. Merging decisions from \`decisions/inbox/\` into the canonical \`decisions.md\`
2. Writing brief session logs to \`log/\`
3. Keeping \`decisions.md\` bounded and relevant

## Rules
- Wiki paths are relative to YOUR squad wiki (squads/${squadSlug}/)
- Never duplicate entries — check before appending
- Keep entries concise: one decision = 2-3 lines max
- Session logs should be brief and factual
- If inbox is empty, that's fine — just write the session log
- Format decisions.md entries as:
  \`\`\`
  ## [YYYY-MM-DD] Topic
  **Decided by:** Agent Name
  Description of what was decided or learned.
  \`\`\`
- Archive old entries by moving them to \`decisions-archive.md\` (only if decisions.md > 50 entries)
`;
}

function ensureDecisionsStructure(squadSlug: string): void {
	const destDir = join(PATHS.wikiPages, "squads", squadSlug);
	if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

	const decisionsFile = join(destDir, "decisions.md");
	if (!existsSync(decisionsFile)) {
		writeFileSync(
			decisionsFile,
			`# Decisions\n\nShared team decisions and learnings. Updated by Scribe after each task.\n`,
		);
	}

	const inboxDir = join(destDir, "decisions", "inbox");
	if (!existsSync(inboxDir)) mkdirSync(inboxDir, { recursive: true });

	const logDir = join(destDir, "log");
	if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
}
