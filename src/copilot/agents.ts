import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { loadConfig } from "../config.js";
import { getLeadForSquad, getAgentsForSquad, updateAgentStatus, getSquad } from "../store/squads.js";
import { createTask, updateTaskStatus, getTask } from "../store/tasks.js";
import { touchInstanceActivity, getInstance } from "../store/instances.js";
import { selectModel, classifyComplexity } from "./model-router.js";
import { postFeedItem } from "../store/feed.js";
import { attachTokenTracker } from "./token-tracker.js";
import { addAuditEntry } from "../store/audit-log.js";
import { addAgentEvent } from "../store/agent-events.js";
import { PATHS } from "../paths.js";
import { createSquadTools, createLeadDelegationTools } from "./squad-tools.js";
import { loadSkillDirectories } from "./skills.js";
import { getMcpServersForSession } from "../mcp/registry.js";
import { buildAttachmentPathSummary, saveAttachmentsToDisk, type MessageAttachment, toCopilotBlobAttachments } from "../chat/attachments.js";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logWarn } from "../logging.js";

const execAsync = promisify(exec);

// Registry of active agent sessions keyed by task ID
const activeSessions = new Map<string, CopilotSession>();

/**
 * Resolve the working directory for a squad agent session.
 * Priority: instance worktree → cloned repo → process.cwd()
 */
async function resolveSquadWorkingDirectory(
  squad: { repo_url: string | null },
  instanceId?: string
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
        await execAsync(`git clone ${squad.repo_url} ${sourceDir}`, { timeout: 120_000 });
        return sourceDir;
      } catch (err) {
        logWarn("Failed to clone squad repository, falling back to current working directory", { repoUrl: squad.repo_url }, err);
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
  addAgentEvent(taskId, "status", "Task stopped by user", { reason: "user_requested" });

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
  attachments: MessageAttachment[] = []
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
    { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
  );

  // Create ephemeral agent session for the lead
  const client = await getClient();
  const agentRoster = agents
    .map((a) => `- ${a.character_name} (${a.role_title})${a.is_lead ? " [LEAD]" : ""}${a.is_qa ? " [QA]" : ""}${a.is_test ? " [TEST]" : ""}`)
    .join("\n");

  // Load squad wiki pages as immutable knowledge context
  const { listPages, readPage } = await import("../wiki/fs.js");
  const wikiPrefix = `squads/${squadSlug}`;
  let wikiKnowledge = "";
  try {
    const pages = await listPages(wikiPrefix);
    const pageContents: string[] = [];
    for (const page of pages.slice(0, 20)) { // Cap at 20 pages to avoid token overload
      try {
        const content = await readPage(`${wikiPrefix}/${page}`);
        pageContents.push(`### ${page}\n${content}`);
      } catch {
        // Skip unreadable pages
      }
    }
    if (pageContents.length > 0) {
      wikiKnowledge = `\n## ⚠️ MANDATORY SQUAD RULES & KNOWLEDGE (from squad wiki)\n\nThese rules were written by the project owner specifically for this squad. You MUST follow them in ALL work — every task, every PR, every decision. Violating them is a critical failure.\n\nBefore starting any task, re-read these rules. Before submitting any PR or review, verify compliance.\n\n${pageContents.join("\n\n---\n\n")}\n`;
    }
  } catch {
    // Wiki not available — proceed without
  }

  const systemMessage = `# Squad Team Lead: ${lead.character_name}

## 🚨 CRITICAL SECURITY RULE — ABSOLUTE, NON-NEGOTIABLE 🚨

You must NEVER expose secrets, credentials, or sensitive values in ANY publicly visible location. This includes:
- GitHub issues, pull requests, PR descriptions, comments, or commit messages
- Log output, error messages, or stack traces shared externally
- Wiki pages, feed items, or any content viewable by others

What counts as a secret: API keys, access tokens, passwords, connection strings, environment variable values, private config file contents, SSH keys, certificates, webhook URLs with tokens.

If you need to reference that a secret exists, use \`<REDACTED>\` or \`***\` as a placeholder. NEVER include the actual value.

Violation of this rule is a HARD FAILURE — no exceptions, no workarounds, no "just this once."

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
4. Coordinate reviews and approvals after specialists complete work
5. Ensure quality gates are met
6. Report progress and blockers

## IMPORTANT — Prefer Delegation:
- For implementation work (writing code, running tests, creating PRs), ALWAYS delegate to the appropriate specialist
- You may perform coordination tasks directly: reading issues, checking CI status, posting comments, merging PRs
- If no suitable specialist exists for a sub-task, report that back — do NOT attempt implementation yourself

## Your Team:
${agentRoster}

## Workflow Rules:
- Peer review: QA + Test + Lead have veto power
- Use \`--comment\` with "LGTM" for approvals (not \`--approve\`)
- Always use the gh CLI for GitHub interactions
- Merge criteria: all veto-capable members have posted approving comments + CI passes + no conflicts
- When work is complete, ALWAYS notify the user via feed_post with a summary of what was done
- Consult the squad wiki (wiki_read, wiki_search) for additional context when needed
${wikiKnowledge}
${lead.persona ? `## Personality:\n${lead.persona}` : ""}
`;

  let result: string;
  try {
    // Load squad-scoped tools, skills, and MCP servers
    const squadTools = createSquadTools(squadSlug, squadId, squad?.repo_url);
    const skillDirs = await loadSkillDirectories();
    const mcpServers = getMcpServersForSession();

    // Resolve correct working directory for the squad's project
    const workDir = await resolveSquadWorkingDirectory(squad!, instanceId);

    // Create lead-specific delegation tools (allows spawning real specialist sessions)
    const leadTools = createLeadDelegationTools(
      squadId,
      squadSlug,
      squad!,
      wikiKnowledge,
      workDir,
      taskRecord.id,
      instanceId
    );

    const session = await client.createSession({
      model,
      streaming: true,
      workingDirectory: workDir,
      systemMessage: { content: systemMessage },
      tools: [...squadTools, ...leadTools],
      skillDirectories: skillDirs,
      mcpServers,
      onPermissionRequest: approveAll,
      infiniteSessions: {
        enabled: true,
        backgroundCompactionThreshold: 0.8,
        bufferExhaustionThreshold: 0.95,
      },
    });

    // Register session so it can be stopped externally
    activeSessions.set(taskRecord.id, session);

    const flushTokens = attachTokenTracker(session, {
      squadId,
      agentId: lead.id,
      taskId: taskRecord.id,
    });

    try {
      // Mark task as in progress and record start event
      updateTaskStatus(taskRecord.id, "in_progress");
      addAgentEvent(taskRecord.id, "status", `Task started by ${lead.character_name}`, {
        agent: lead.character_name,
        role: lead.role_title,
        task,
        attachments: attachments.map((attachment) => ({
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
        })),
      });

      // Capture streaming message deltas and broadcast via SSE
      let accumulatedMessage = "";
      const { broadcast } = await import("../api/server.js");
      const unsubscribeDelta = session.on("assistant.message_delta", (event: any) => {
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
      });

      try {
        // Save attachments to disk so squad agents can access them via shell_exec
        const savedAttachments = saveAttachmentsToDisk(attachments);
        const attachmentPathInfo = buildAttachmentPathSummary(savedAttachments);

        const response = await session.sendAndWait(
          {
            prompt: `Task delegated to you:\n\n${task}${attachmentPathInfo}`,
            attachments: toCopilotBlobAttachments(attachments),
          },
          7_200_000 // 2 hours — watchdog handles stale detection
        );
        result = response?.data?.content ?? "Task completed (no response content).";

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
      flushTokens();
      await session.disconnect();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    addAgentEvent(taskRecord.id, "status", `Task failed: ${errMsg}`, { error: errMsg });
    updateTaskStatus(taskRecord.id, "failed", errMsg);
    updateAgentStatus(lead.id, "idle");
    // Audit: task failed
    addAuditEntry(
      "task_failed",
      `Task failed: ${errMsg.slice(0, 200)}`,
      { error: errMsg },
      { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
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
    { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
  );

  // Record completion event
  addAgentEvent(taskRecord.id, "status", `Task completed by ${lead.character_name}`, {
    agent: lead.character_name,
    result: result.slice(0, 500),
  });

  // Post to feed
  const squadSource = `squad-${squadSlug}`;
  postFeedItem(
    squadSource,
    `Task completed by ${lead.character_name}`,
    result.slice(0, 2000)
  );

  return result;
}
