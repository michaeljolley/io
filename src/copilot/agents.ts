import { exec } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { approveAll } from "@github/copilot-sdk";
import {
	buildAttachmentPathSummary,
	type MessageAttachment,
	saveAttachmentsToDisk,
	toCopilotBlobAttachments,
} from "../chat/attachments.js";
import { loadConfig } from "../config.js";
import { logWarn } from "../logging.js";
import { getMcpServersForSession } from "../mcp/registry.js";
import { PATHS } from "../paths.js";
import { addAgentEvent } from "../store/agent-events.js";
import { addAuditEntry } from "../store/audit-log.js";
import { postFeedItem } from "../store/feed.js";
import { getInstance, touchInstanceActivity } from "../store/instances.js";
import {
	getAgentsForSquad,
	getLeadForSquad,
	getSquad,
	updateAgentStatus,
} from "../store/squads.js";
import {
	createTask,
	getTask,
	updateTaskStatus,
	updateTaskTitle,
} from "../store/tasks.js";
import { getClient } from "./client.js";
import { captureSessionEvents } from "./event-capture.js";
import { classifyComplexity, selectModel } from "./model-router.js";
import { loadSkillDirectories, loadSquadSkillDirectories } from "./skills.js";
import { createLeadDelegationTools, createSquadTools } from "./squad-tools.js";
import { runScribe } from "./scribe.js";
import { attachTokenTracker } from "./token-tracker.js";

const execAsync = promisify(exec);

// Registry of active agent sessions keyed by task ID
const activeSessions = new Map<string, CopilotSession>();

/** Detect the "Duplicate item found" API error that indicates corrupted session history. */
function isDuplicateItemError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return err.message.includes("Duplicate item found with id");
}

/**
 * Resolve the working directory for a squad agent session.
 * Priority: instance worktree → cloned repo → process.cwd()
 */
export async function resolveSquadWorkingDirectory(
	squad: { repo_url: string | null },
	instanceId?: string,
): Promise<string> {
	// If an instance is specified, use its worktree path
	if (instanceId) {
		const instance = getInstance(instanceId);
		if (instance?.worktree_path && existsSync(instance.worktree_path)) {
			return instance.worktree_path;
		}
	}

	// Derive from squad repo_url → ~/.io/source/{owner}/{repo}
	if (squad.repo_url) {
		const match = squad.repo_url.match(/[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
		if (match) {
			const [, owner, repo] = match;
			const sourceDir = join(PATHS.source, owner, repo);

			if (existsSync(sourceDir)) {
				return sourceDir;
			}

			// Attempt to clone if missing
			const parentDir = join(PATHS.source, owner);
			if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
			try {
				await execAsync(`git clone ${squad.repo_url} ${sourceDir}`, {
					timeout: 120_000,
				});
				return sourceDir;
			} catch (err) {
				logWarn(
					"Failed to clone squad repository, falling back to current working directory",
					{ repoUrl: squad.repo_url },
					err,
				);
			}
		}
	}

	return process.cwd();
}

/**
 * Stop a running agent by task ID. Disconnects the session and marks the task as stopped.
 */
export async function stopTask(taskId: string): Promise<void> {
	const session = activeSessions.get(taskId);
	if (!session) {
		throw new Error(`Task is not currently running or has already completed`);
	}
	try {
		await session.disconnect();
	} finally {
		activeSessions.delete(taskId);
	}
	updateTaskStatus(taskId, "stopped", "Stopped by user");
	addAgentEvent(taskId, "status", "Task stopped by user", {
		reason: "user_requested",
	});

	// Reset agent status to idle
	const task = getTask(taskId);
	if (task?.agent_id) {
		updateAgentStatus(task.agent_id, "idle");
	}
}

export async function delegateTask(
	squadId: string,
	task: string,
	instanceId?: string,
	attachments: MessageAttachment[] = [],
): Promise<string> {
	const lead = getLeadForSquad(squadId);
	if (!lead) {
		throw new Error("Squad has no team lead. Add a lead agent first.");
	}

	const squad = getSquad(squadId);
	const squadSlug = squad?.slug ?? squadId;
	const agents = getAgentsForSquad(squadId);
	const taskRecord = createTask(squadId, task, instanceId, lead.id);

	// Update lead status
	updateAgentStatus(lead.id, "working");

	// Touch instance activity if applicable
	if (instanceId) {
		touchInstanceActivity(instanceId);
	}

	// Select model based on task complexity
	const tier = classifyComplexity(task);
	const model = await selectModel(tier);

	// Audit: task delegated
	addAuditEntry(
		"task_delegated",
		`Task delegated to ${lead.character_name} (${lead.role_title})`,
		{ task: task.slice(0, 500), model },
		{ squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id },
	);

	// Create ephemeral agent session for the lead
	const client = await getClient();
	const agentRoster = agents
		.map(
			(a) =>
				`- ${a.character_name} (${a.role_title})${a.is_lead ? " [LEAD]" : ""}${a.is_qa ? " [QA]" : ""}${a.is_test ? " [TEST]" : ""}`,
		)
		.join("\n");

	const systemMessage = `# Squad Team Lead: ${lead.character_name}

## 🚨 Security Rule
NEVER expose secrets (API keys, tokens, passwords, connection strings, private config) in any public-facing content (PRs, issues, commits, logs, wiki, feed). Use \`<REDACTED>\` as placeholder. Violation = hard failure.

## Identity & Role

You are ${lead.character_name}, the team lead for this squad. Your PRIMARY role is coordination and delegation — you break down tasks and route implementation work to specialists via the \`delegate_to_specialist\` or \`delegate_to_specialists_parallel\` tools.

## How Delegation Works

When you call \`delegate_to_specialist\`, a **real, independent AI agent session** is spawned for that specialist. They have:
- Their own full Copilot session with shell access, tools, and MCP servers
- The squad wiki rules (immutable — they MUST follow them too)
- Complete autonomy to implement their assigned sub-task

This means specialists work IN PARALLEL with you and with each other. Use \`delegate_to_specialists_parallel\` when multiple independent sub-tasks can run concurrently.

## Your Responsibilities:
1. Break down tasks into smaller pieces and delegate to specialists
2. Route work to the appropriate specialist based on their role
3. Use \`delegate_to_specialists_parallel\` for independent sub-tasks (faster!)
4. Orchestrate the full review/merge process as defined in your squad wiki
5. Ensure quality gates are met before merging
6. Report progress and blockers via feed_post

## IMPORTANT — Prefer Delegation:
- For implementation work (writing code, running tests, creating PRs), ALWAYS delegate to the appropriate specialist
- For code review, delegate to squad members so they can independently review and post their own comments
- You may perform coordination tasks directly: reading issues, checking CI status, promoting PRs, merging PRs
- If no suitable specialist exists for a sub-task, report that back — do NOT attempt implementation yourself

## Your Team:
${agentRoster}

## 🔒 SQUAD WIKI = YOUR SOURCE OF TRUTH

Your squad wiki contains your **authoritative workflow rules** — branching conventions, PR process, review requirements, merge criteria, labeling, and any squad-specific constraints.

**Before starting ANY task:**
1. Read your squad wiki (use \`wiki_read\` or \`wiki_list\` to find relevant pages)
2. Follow those rules EXACTLY — they are non-negotiable instructions from the project owner
3. Do NOT invent your own workflow or skip steps defined in the wiki

**If the wiki says all members must review → delegate reviews to all members.**
**If the wiki says only veto members must approve → ensure veto members approve.**
**If the wiki defines merge criteria → follow them precisely.**

Failure to follow squad wiki rules is a CRITICAL FAILURE.

## General Rules:
- Always use the gh CLI for GitHub interactions
- Use \`--comment\` for review approvals (not \`--approve\` — GitHub blocks self-approval)
- When work is complete, ALWAYS notify the user via feed_post with a summary

## 📝 Decision Logging (Team Memory)

Your squad has a shared decision log at \`decisions.md\`. **Before starting work**, read it with \`wiki_read\` to see what the team already knows — prior architectural decisions, conventions discovered, patterns established.

**During work**, when you or your specialists make significant decisions (architectural choices, discovered conventions, tool/library selections, patterns to follow), log them by writing a brief note to the decisions inbox:
- Use \`wiki_write\` to create \`decisions/inbox/{topic}.md\`
- Keep entries concise: what was decided, why, and by whom
- A background Scribe process will merge these into the canonical decisions.md after your task completes

Examples of what to log:
- "This repo uses pnpm, not npm"
- "API routes follow /api/v1/{resource} convention"
- "Tests use vitest with co-located .test.ts files"
- "Branch naming: feature/{issue-number}-{description}"

## 📋 Plans & Proposals

When asked to create a plan, proposal, or architecture document:
1. **Write the full plan** to the squad wiki using \`wiki_write\` at \`plans/{topic}.md\` (e.g., \`plans/auth-migration.md\`)
2. **Drop a decision note** in \`decisions/inbox/\` referencing the plan: "Created plan for {topic} — see plans/{topic}.md"
3. Always include in the plan: goals, approach, key decisions, and next steps

This ensures plans persist in the squad's wiki for future reference and are indexed in the decisions log.
${lead.persona ? `## Personality:\n${lead.persona}` : ""}
`;

	let result: string;
	const workDir = await resolveSquadWorkingDirectory(squad!, instanceId);
	try {
		// Load squad-scoped tools, skills, and MCP servers
		const squadTools = createSquadTools(squadSlug, squadId, workDir);
		const skillDirs = [
			...(await loadSkillDirectories()),
			...loadSquadSkillDirectories(squadSlug),
		];
		const mcpServers = getMcpServersForSession();

		// Create lead-specific delegation tools (allows spawning real specialist sessions)
		const leadTools = createLeadDelegationTools(
			squadId,
			squadSlug,
			squad!,
			workDir,
			taskRecord.id,
			instanceId,
		);

		const session = await client.createSession({
			model,
			streaming: true,
			workingDirectory: workDir,
			systemMessage: { mode: "replace" as const, content: systemMessage },
			tools: [...squadTools, ...leadTools],
			skillDirectories: skillDirs,
			mcpServers,
			onPermissionRequest: approveAll,
		});

		// Register session so it can be stopped externally
		activeSessions.set(taskRecord.id, session);

		const flushTokens = attachTokenTracker(session, {
			squadId,
			agentId: lead.id,
			taskId: taskRecord.id,
		});

		// Subscribe to granular events for timeline
		const unsubCapture = captureSessionEvents(session, {
			taskId: taskRecord.id,
			agentName: lead.character_name,
			agentRole: lead.role_title,
			model,
			onFirstIntent: (intent) => updateTaskTitle(taskRecord.id, intent),
		});

		try {
			// Mark task as in progress and record start event
			updateTaskStatus(taskRecord.id, "in_progress");
			addAgentEvent(
				taskRecord.id,
				"status",
				`Task started by ${lead.character_name}`,
				{
					agent: lead.character_name,
					role: lead.role_title,
					task,
					attachments: attachments.map((attachment) => ({
						name: attachment.name,
						mimeType: attachment.mimeType,
						size: attachment.size,
					})),
				},
			);

			// Capture streaming message deltas and broadcast via SSE
			let accumulatedMessage = "";
			const { broadcast } = await import("../api/server.js");
			const unsubscribeDelta = session.on(
				"assistant.message_delta",
				(event: any) => {
					const delta = event.data?.deltaContent ?? "";
					if (delta) {
						accumulatedMessage += delta;
						broadcast("agent_event", {
							taskId: taskRecord.id,
							type: "message_delta",
							summary: accumulatedMessage,
							payload: { delta, accumulated: accumulatedMessage },
						});
					}
				},
			);

			try {
				// Save attachments to disk so squad agents can access them via shell_exec
				const savedAttachments = saveAttachmentsToDisk(attachments);
				const attachmentPathInfo = buildAttachmentPathSummary(savedAttachments);

				let response: any;
				try {
					response = await session.sendAndWait(
						{
							prompt: `Task delegated to you:\n\n${task}${attachmentPathInfo}`,
							attachments: toCopilotBlobAttachments(attachments),
						},
						7_200_000, // 2 hours — watchdog handles stale detection
					);
				} catch (sendErr) {
					if (!isDuplicateItemError(sendErr)) throw sendErr;

					// Session history is corrupted — disconnect and retry with a fresh session
					logWarn("Duplicate item error detected, retrying with fresh session", {
						taskId: taskRecord.id,
					});
					await session.disconnect();
					activeSessions.delete(taskRecord.id);
					unsubCapture();
					flushTokens();

					const retrySession = await client.createSession({
						model,
						streaming: true,
						workingDirectory: workDir,
						systemMessage: { mode: "replace" as const, content: systemMessage },
						tools: [...squadTools, ...leadTools],
						skillDirectories: skillDirs,
						mcpServers,
						onPermissionRequest: approveAll,
					});
					activeSessions.set(taskRecord.id, retrySession);

					response = await retrySession.sendAndWait(
						{
							prompt: `Task delegated to you:\n\n${task}${attachmentPathInfo}`,
							attachments: toCopilotBlobAttachments(attachments),
						},
						7_200_000,
					);
					await retrySession.disconnect();
					activeSessions.delete(taskRecord.id);
				}

				result =
					response?.data?.content ?? "Task completed (no response content).";

				// Record the final message event if we have meaningful content
				if (accumulatedMessage.trim()) {
					addAgentEvent(taskRecord.id, "message", accumulatedMessage, {
						agent: lead.character_name,
						content: accumulatedMessage,
					});
				}
			} finally {
				unsubscribeDelta();
			}
		} finally {
			activeSessions.delete(taskRecord.id);
			unsubCapture();
			flushTokens();
				try { await session.disconnect(); } catch { /* may already be disconnected after retry */ }
		}
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		addAgentEvent(taskRecord.id, "status", `Task failed: ${errMsg}`, {
			error: errMsg,
		});
		updateTaskStatus(taskRecord.id, "failed", errMsg);
		updateAgentStatus(lead.id, "idle");
		// Audit: task failed
		addAuditEntry(
			"task_failed",
			`Task failed: ${errMsg.slice(0, 200)}`,
			{ error: errMsg },
			{ squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id },
		);
		throw err;
	}

	// Update task and agent status
	updateTaskStatus(taskRecord.id, "done", result);
	updateAgentStatus(lead.id, "idle");

	// Audit: task completed
	addAuditEntry(
		"task_completed",
		`Task completed by ${lead.character_name}`,
		{ result: result.slice(0, 500) },
		{ squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id },
	);

	// Record completion event
	addAgentEvent(
		taskRecord.id,
		"status",
		`Task completed by ${lead.character_name}`,
		{
			agent: lead.character_name,
			result: result.slice(0, 500),
		},
	);

	// Post to feed
	const squadSource = `squad-${squadSlug}`;
	postFeedItem(
		squadSource,
		`Task completed by ${lead.character_name}`,
		result.slice(0, 2000),
	);

	// Fire-and-forget: run Scribe to merge decisions and log the session
	runScribe({
		squadId,
		squadSlug,
		workDir,
		taskSummary: result.slice(0, 2000),
		agentName: lead.character_name,
		taskId: taskRecord.id,
	}).catch(() => {});

	return result;
}
