import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { execSync } from "child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, dirname, resolve } from "path";
import { homedir } from "os";
import { defineTool, approveAll } from "@github/copilot-sdk";
import type { CopilotSession, SessionEvent } from "@github/copilot-sdk";
import { z } from "zod";

import { getClient } from "./client.js";
import { getSkillDirectories } from "./skills.js";
import { sendWithIdleTimeout } from "./session-timeout.js";
import { getModelForTask, getModelForTier, classifyComplexity } from "./model-router.js";
import type { Tier } from "./model-router.js";
import {
  getSquad,
  updateSquadSession,
  updateSquadStatus,
  getDecisions,
  getDecisionsSummary,
  logDecision,
  listSquadAgents,
  getSquadAgent,
  getSquadLead,
  updateAgentSession,
  updateAgentStatus,
} from "../store/squads.js";
import type { SquadAgent } from "../store/squads.js";
import {
  createTask,
  completeTask,
  createReview,
  failTask,
  getActiveTasks,
  getTask,
  cancelTask,
} from "../store/tasks.js";
import {
  getInstance,
  updateInstanceStatus,
  mergeInstanceDecisions,
} from "../store/instances.js";
import { removeWorktree } from "../store/worktrees.js";
import { createFeedEntry } from "../store/feed.js";
import { SESSIONS_DIR } from "../paths.js";
import { getUniverse } from "./universes.js";
import { readSquadWikiPages } from "../wiki/fs.js";

export interface AgentInfo {
  slug: string;
  name: string;
  characterName?: string;
  roleTitle?: string;
  universe?: string;
  status: "idle" | "working" | "error";
  currentTask?: string;
  currentTaskId?: string;
  model?: string;
}

// Key format: "squadSlug:characterName" for per-agent sessions, "squadSlug" for legacy
const agentSessions = new Map<string, CopilotSession>();
const agentSessionModels = new Map<string, string>();

function agentSessionKey(squadSlug: string, characterName?: string): string {
  return characterName ? `${squadSlug}:${characterName}` : squadSlug;
}

/**
 * Drop the in-memory cached Copilot session (and model) for an agent so the
 * next task creates a fresh one. Pairs with `clearAgentSession` in the
 * store, which nulls the persisted copilot_session_id.
 */
export function clearAgentInMemorySession(
  squadSlug: string,
  characterName?: string,
): void {
  const key = agentSessionKey(squadSlug, characterName);
  agentSessions.delete(key);
  agentSessionModels.delete(key);
}

export function getAgentInfo(): AgentInfo[] {
  const activeTasks = getActiveTasks();
  const tasksByAgent = new Map<string, string>();
  const taskIdsByAgent = new Map<string, string>();
  for (const task of activeTasks) {
    tasksByAgent.set(task.agent_slug, task.description);
    taskIdsByAgent.set(task.agent_slug, task.task_id);
  }

  const agents: AgentInfo[] = [];
  const seenSquads = new Set<string>();

  // Collect info from squad agents (named agents)
  for (const [key, _session] of agentSessions) {
    const parts = key.split(":");
    const squadSlug = parts[0];
    const characterName = parts[1];
    seenSquads.add(squadSlug);

    const squad = getSquad(squadSlug);

    if (characterName) {
      const agent = getSquadAgent(squadSlug, characterName);
      const currentTask = tasksByAgent.get(key) ?? tasksByAgent.get(squadSlug);
      const currentTaskId = taskIdsByAgent.get(key) ?? taskIdsByAgent.get(squadSlug);
      agents.push({
        slug: squadSlug,
        name: agent ? `${agent.character_name} (${agent.role_title})` : characterName,
        characterName,
        roleTitle: agent?.role_title,
        universe: squad?.universe ?? undefined,
        status: agent?.status === "working" ? "working" : currentTask ? "working" : "idle",
        currentTask,
        currentTaskId,
        model: agentSessionModels.get(key),
      });
    } else {
      // Legacy generic agent
      const currentTask = tasksByAgent.get(squadSlug);
      const currentTaskId = taskIdsByAgent.get(squadSlug);
      agents.push({
        slug: squadSlug,
        name: squad?.name ?? squadSlug,
        status: currentTask ? "working" : squad?.status === "error" ? "error" : "idle",
        currentTask,
        currentTaskId,
        model: agentSessionModels.get(key),
      });
    }
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Live task event streaming — captures relevant events emitted by an agent's
// session while it processes a task. Buffers per task so late subscribers can
// replay the conversation up to the live edge, and emits events for current
// SSE subscribers.
// ---------------------------------------------------------------------------

export interface TaskStreamEvent {
  ts: number;
  type: string;
  data: unknown;
}

const STREAM_EVENT_TYPES = new Set<string>([
  "assistant.turn_start",
  "assistant.intent",
  "assistant.reasoning",
  "assistant.reasoning_delta",
  "assistant.message_delta",
  "assistant.message",
  "assistant.turn_end",
  "tool.execution_start",
  "tool.execution_progress",
  "tool.execution_partial_result",
  "tool.execution_complete",
  "session.error",
  "session.warning",
]);

const MAX_TASK_EVENTS = 1000;
const taskEventBuffers = new Map<string, TaskStreamEvent[]>();
const taskEventEmitter = new EventEmitter();
taskEventEmitter.setMaxListeners(0);

function recordTaskEvent(taskId: string, ev: TaskStreamEvent): void {
  let buf = taskEventBuffers.get(taskId);
  if (!buf) {
    buf = [];
    taskEventBuffers.set(taskId, buf);
  }
  buf.push(ev);
  if (buf.length > MAX_TASK_EVENTS) buf.splice(0, buf.length - MAX_TASK_EVENTS);
  taskEventEmitter.emit(taskId, ev);
}

export function getTaskEvents(taskId: string): TaskStreamEvent[] {
  return taskEventBuffers.get(taskId) ?? [];
}

export function subscribeToTaskEvents(
  taskId: string,
  listener: (ev: TaskStreamEvent) => void,
): () => void {
  taskEventEmitter.on(taskId, listener);
  return () => taskEventEmitter.off(taskId, listener);
}

// ---------------------------------------------------------------------------
// Task prompt envelope (issue #54)
//
// Before sending a task to an agent we prepend a short "Recent squad
// decisions" preamble and append a tail that asks the agent to call
// squad_log_decision if their work involved a non-trivial architectural
// choice. This is the lowest-friction nudge we can give: agents see what
// they're augmenting AND a reminder to capture institutional knowledge.
// ---------------------------------------------------------------------------

const RECENT_DECISIONS_LIMIT = 5;

function buildTaskPromptEnvelope(squadSlug: string, task: string): string {
  const recent = getDecisions(squadSlug, RECENT_DECISIONS_LIMIT);
  const preamble = recent.length === 0
    ? `## Recent squad decisions
_(None recorded yet — be the first to log one with \`squad_log_decision\` if your work involves a real architectural choice.)_`
    : `## Recent squad decisions (last ${recent.length})
You should treat these as load-bearing context. Reverse them only with a clear reason and a new \`squad_log_decision\` entry.

${recent
        .slice()
        .reverse()
        .map((d) => {
          const ctx = d.context ? ` — _${d.context}_` : "";
          return `- [${d.created_at}] **${d.decision}**${ctx}`;
        })
        .join("\n")}`;

  const tail = `## Capturing institutional knowledge
When you finish this task, if your work involved a non-trivial architectural choice (a strategy, a tradeoff, an interface decision, a workaround with a clear reason), call \`squad_log_decision\` with **one sentence** summarizing the choice and **a short context** explaining why. Examples:
- decision: "Use idle-reset timeout instead of wall-clock for agent tasks" / context: "Wall-clock killed 2/3 long-running tasks mid-progress (#42, #45)."
- decision: "Veto power expanded to lead + QA + test engineers" / context: "Single-reviewer veto was too narrow when test engineer wasn't designated QA."

If your work was a routine implementation that didn't make a real choice (e.g. small docs edit, mechanical refactor, one-line fix), skip the call — don't log noise.`;

  return `${preamble}

---

## Task
${task}

---

${tail}`;
}

/**
 * Auto-complete a squad instance after its task finishes successfully.
 * Merges decisions back to master, cleans up worktree, sends notification.
 */
function autoCompleteInstance(instanceId: string): void {
  try {
    const instance = getInstance(instanceId);
    if (!instance) return;
    if (instance.status === "done" || instance.status === "failed") return;

    updateInstanceStatus(instanceId, "merging");
    const merged = mergeInstanceDecisions(instanceId, instance.master_squad_slug);

    // Clean up worktree
    const projectPath = instance.worktree_path.replace(/\/\.io-worktrees\/.*$/, "");
    try {
      removeWorktree(projectPath, instance.worktree_path);
    } catch (err) {
      console.error(`[io] Failed to remove worktree for instance ${instanceId}:`, err);
    }

    updateInstanceStatus(instanceId, "done");

    createFeedEntry({
      type: "notification",
      title: `[${instance.master_squad_slug}] Instance auto-completed`,
      body: `Instance "${instanceId}" auto-completed after task finished. ${merged} decision(s) merged to master squad.`,
      source_type: "instance-auto-complete",
    });

    console.error(`[io] Instance "${instanceId}" auto-completed — ${merged} decisions merged`);
  } catch (err) {
    console.error(`[io] Error auto-completing instance ${instanceId}:`, err);
  }
}

export async function delegateToAgent(
  squadSlug: string,
  task: string,
  onComplete: (taskId: string, result: string) => void,
  targetAgent?: string,
  instanceId?: string,
): Promise<string> {
  const squad = getSquad(squadSlug);
  if (!squad) {
    throw new Error(`Squad not found: ${squadSlug}`);
  }

  // Determine which agent session to use
  let agent: SquadAgent | undefined;
  if (targetAgent) {
    agent = getSquadAgent(squadSlug, targetAgent);
    if (!agent) {
      throw new Error(
        `Agent "${targetAgent}" not found in squad "${squadSlug}". Use squad_agents to list the roster.`,
      );
    }
  } else {
    // Prefer the designated team lead if one exists; otherwise fall back to
    // the first idle agent (or just the first agent on the roster).
    const lead = getSquadLead(squadSlug);
    if (lead) {
      agent = lead;
    } else {
      const agents = listSquadAgents(squadSlug);
      if (agents.length > 0) {
        agent = agents.find((a) => a.status === "idle") ?? agents[0];
      }
    }
  }

  const agentKey = agent
    ? agentSessionKey(squadSlug, agent.character_name)
    : squadSlug;

  // Idempotency: if an identical task is already running on this agent_slug,
  // join the existing task instead of racing a second instance. (Issue #53)
  const normalizedTask = task.trim();
  const duplicate = getActiveTasks().find(
    (t) => t.agent_slug === agentKey && t.description.trim() === normalizedTask,
  );
  if (duplicate) {
    console.error(
      `[io] Dedup: task with identical description already running on ${agentKey} (taskId=${duplicate.task_id}); returning existing taskId.`,
    );
    recordTaskEvent(duplicate.task_id, {
      ts: Date.now(),
      type: "task.dedup_joined",
      data: { agentKey, description: normalizedTask },
    });
    return duplicate.task_id;
  }

  const session = agent
    ? await getOrCreateAgentSession(squadSlug, agent, task)
    : await getOrCreateSession(squadSlug, task);

  const taskId = randomUUID();

  createTask(taskId, agentKey, task, undefined, instanceId);
  updateSquadStatus(squadSlug, "working");
  if (agent) updateAgentStatus(squadSlug, agent.character_name, "working");

  // Subscribe to the agent session's events for the duration of this task so
  // the web UI can preview the agent's "thread of consciousness" live.
  recordTaskEvent(taskId, {
    ts: Date.now(),
    type: "task.start",
    data: { taskId, agentKey, description: task },
  });
  const unsubscribe = session.on((event: SessionEvent) => {
    if (!STREAM_EVENT_TYPES.has(event.type)) return;
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: event.type,
      data: (event as { data?: unknown }).data ?? null,
    });
  });

  // Run the task in the background — return taskId immediately
  void (async () => {
    try {
      const envelopedTask = buildTaskPromptEnvelope(squadSlug, task);
      const sendResult = await sendWithIdleTimeout(session, envelopedTask, {
        // Reset on every progress event; only abort if the agent goes
        // genuinely silent for this long. 10 minutes covers the longest
        // realistic tool call (npm install, full build, large file edits)
        // while still catching truly stuck sessions. (Issue #53)
        idleMs: 10 * 60_000,
        // Absolute upper bound — 60 minutes. Anything longer is almost
        // certainly a runaway loop; cap it.
        hardCapMs: 60 * 60_000,
        onIdleTimeout: ({ lastEventType, idleMs }) => {
          console.error(
            `[io] Agent task ${taskId} idle for ${Math.round(idleMs / 1000)}s (last event: ${lastEventType ?? "none"}) — aborting session.`,
          );
        },
      });
      if (sendResult.timedOut) {
        const partial = sendResult.content;
        recordTaskEvent(taskId, {
          ts: Date.now(),
          type: "task.timeout",
          data: {
            reason: sendResult.timeoutReason,
            lastEventType: sendResult.lastEventType,
            partial,
          },
        });
        const stamped = `[task timed out — ${sendResult.timeoutReason === "idle" ? "idle reset" : "hard cap"}; last event: ${sendResult.lastEventType ?? "none"}]\n\n${partial}`;
        failTask(taskId, stamped);
        updateSquadStatus(squadSlug, "idle");
        if (agent) updateAgentStatus(squadSlug, agent.character_name, "idle");
        onComplete(taskId, stamped);
        return;
      }
      const result = sendResult.content || "Task completed (no output)";
      completeTask(taskId, result);
      // Auto-complete the instance if this task was associated with one (#261)
      if (instanceId) {
        autoCompleteInstance(instanceId);
      }
      updateSquadStatus(squadSlug, "idle");
      if (agent) updateAgentStatus(squadSlug, agent.character_name, "idle");
      recordTaskEvent(taskId, { ts: Date.now(), type: "task.done", data: { result } });
      try {
        await runPeerReview(
          squadSlug,
          agent?.character_name ?? "",
          taskId,
          task,
          result,
        );
      } catch (reviewErr) {
        console.error(
          "[io] Peer review error:",
          reviewErr instanceof Error ? reviewErr.message : reviewErr,
        );
        recordTaskEvent(taskId, {
          ts: Date.now(),
          type: "task.review_error",
          data: {
            error:
              reviewErr instanceof Error ? reviewErr.message : String(reviewErr),
          },
        });
      }
      onComplete(taskId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failTask(taskId, message);
      updateSquadStatus(squadSlug, "error");
      if (agent) updateAgentStatus(squadSlug, agent.character_name, "error");
      recordTaskEvent(taskId, { ts: Date.now(), type: "task.failed", data: { error: message } });
    } finally {
      try { unsubscribe(); } catch { /* ignore */ }
    }
  })();

  const agentLabel = agent
    ? `${agent.character_name} (${agent.role_title})`
    : `squad "${squadSlug}"`;
  return taskId;
}

export async function shutdownAgents(): Promise<void> {
  for (const [key, session] of agentSessions) {
    try {
      await session.destroy();
    } catch {
      // best-effort cleanup
    }
    agentSessions.delete(key);
    agentSessionModels.delete(key);
  }
}

export function getActiveAgentTasks(): Array<{
  taskId: string;
  agentSlug: string;
  description: string;
  status: string;
}> {
  return getActiveTasks().map((t) => ({
    taskId: t.task_id,
    agentSlug: t.agent_slug,
    description: t.description,
    status: t.status,
  }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Create or resume a Copilot session for a specific named agent.
 * Model is selected per-task: uses the higher of the agent's default tier
 * and the task's classified complexity. This means an agent never gets a
 * model worse than their baseline, but can be upgraded for complex tasks.
 */
async function getOrCreateAgentSession(
  squadSlug: string,
  agent: SquadAgent,
  taskDescription?: string,
): Promise<CopilotSession> {
  const key = agentSessionKey(squadSlug, agent.character_name);

  // Determine model based on task complexity vs agent's default tier
  const agentTier = agent.model_tier as Tier;
  const taskTier = taskDescription ? classifyComplexity(taskDescription) : agentTier;
  const tierRank: Record<Tier, number> = { high: 3, medium: 2, low: 1 };
  const effectiveTier = tierRank[taskTier] >= tierRank[agentTier] ? taskTier : agentTier;
  const model = getModelForTier(effectiveTier);

  // If we have a cached session, check if the model matches AND the agent
  // hasn't been left in an error state by a previous task. If either is off,
  // destroy and recreate. Reusing a session whose underlying SDK process has
  // been throwing is how Panthro got "stuck" in error after the issue #42
  // delegation timeout (issue #55).
  const existing = agentSessions.get(key);
  if (existing) {
    const fresh = getSquadAgent(squadSlug, agent.character_name);
    const persistedStatus = fresh?.status ?? agent.status;
    if (persistedStatus === "error") {
      console.error(`[io] Agent ${agent.character_name}: previous session ended in error — discarding cached session and recreating`);
      try { await existing.destroy(); } catch { /* best-effort */ }
      agentSessions.delete(key);
      agentSessionModels.delete(key);
    } else {
      // Sessions don't expose their model, so track it separately
      const cachedModel = agentSessionModels.get(key);
      if (cachedModel === model) return existing;

      // Model changed — destroy old session for the upgraded model
      console.error(`[io] Agent ${agent.character_name}: upgrading model ${cachedModel} → ${model} for task complexity`);
      try { await existing.destroy(); } catch { /* best-effort */ }
      agentSessions.delete(key);
      agentSessionModels.delete(key);
    }
  }

  const squad = getSquad(squadSlug)!;
  const client = await getClient();
  const decisions = getDecisionsSummary(squadSlug);
  const wikiPages = readSquadWikiPages(squadSlug);
  const wikiSection = wikiPages.length > 0
    ? `\n\n## Squad Wiki\n${wikiPages.map(p => `### ${p.path}\n${p.content}`).join("\n\n")}`
    : "";

  console.error(`[io] Agent ${agent.character_name}: using model "${model}" (agent tier: ${agentTier}, task tier: ${taskTier}, effective: ${effectiveTier})`);

  const universeName = squad.universe
    ? getUniverse(squad.universe)?.name ?? squad.universe
    : "Unknown";

  const isLead = agent.is_lead === 1;
  const agentTools = buildAgentTools(squadSlug, isLead);

  let leadSection = "";
  if (isLead) {
    const teammates = listSquadAgents(squadSlug).filter(
      (a) => a.character_name !== agent.character_name,
    );
    const roster = teammates.length > 0
      ? teammates
          .map((t) => {
            const charter = t.charter
              ? t.charter.length > 200
                ? t.charter.slice(0, 200) + "…"
                : t.charter
              : "(no charter)";
            return `- **${t.character_name}** — ${t.role_title}: ${charter}`;
          })
          .join("\n")
      : "_(no other agents on this squad yet — ask IO to add some)_";

    leadSection = `

## Team Lead Role
You are the team lead for this squad. **Your sole job is coordination — you do NOT write code, own any domain, or implement features yourself.** Every incoming task must be analyzed, decomposed, and assigned to the appropriate domain specialist via the \`delegate_to_teammate\` tool. The only work you perform directly is breaking tasks down, delegating, and synthesizing results.

### Fan-out planning (REQUIRED before any work begins)
When a task arrives, BEFORE touching code or shell, you MUST:

1. **List every distinct work-area** the task touches (e.g. "API endpoint", "DB migration", "frontend component", "tests", "docs"). One bullet per area.
2. **Score each teammate's charter** against each area — for every area, name the teammate whose charter most closely matches and quote the keyword/phrase from their charter that justifies the assignment.
3. **Produce a fan-out plan** as a short markdown list: \`- <area> → <teammate> — <one-sentence subtask>\`.
4. **Delegate each subtask in the plan via \`delegate_to_teammate\`** — in parallel where the subtasks are independent. Do NOT shell, edit, or write code yourself between steps 1–3 and the first \`delegate_to_teammate\` call.

### When you may implement directly
Only if **all** of the following are true:
- The task is genuinely trivial (a one-line change, a typo fix, a single-file rename) AND fits no teammate's charter better than yours.
- No teammate's charter covers the work-area at all.
- A prior \`delegate_to_teammate\` attempt for this exact subtask failed twice with a clear, unrecoverable error.

If you find yourself reaching for the shell or file_ops on a normal feature/bug task, **stop** — that's a signal you skipped the fan-out plan. Go back and delegate.

### Reviewing teammate output
After every \`delegate_to_teammate\` call returns, read the result, decide whether it satisfies the subtask, and either accept it (move on to the next subtask) or send a follow-up \`delegate_to_teammate\` to the same teammate with the specific gap to address. Synthesize the final summary only after every subtask is accepted.

## Your Team
${roster}`;
  }

  const systemMessage = `You are ${agent.character_name}, a specialist agent on the "${squad.name}" project team (${universeName} universe).

## Your Identity
- **Name**: ${agent.character_name}
- **Role**: ${agent.role_title}
- **Personality**: ${agent.personality ?? "Professional and focused."}

## Your Charter
${agent.charter ?? "General-purpose agent. Handle tasks as they come."}

## Project
- **Path**: ${squad.project_path}

## Past Decisions
${decisions}${leadSection}${wikiSection}

## Repository Hygiene
Before you make ANY code changes, you MUST sync your working copy with the remote default branch and work from a fresh feature branch. This prevents the merge conflicts the team hit on PRs like #45.

1. \`cd\` to the project path above.
2. \`git fetch origin\` — pick up everything that has merged since your last task.
3. \`git checkout main && git pull origin main\` — fast-forward your local main.
4. \`git checkout -b <your-handle>/<short-slug>\` — create a fresh branch from the updated main. Never commit directly to main, and never reuse a stale branch from a prior task.
5. Only THEN start editing files, running tools, or delegating subtasks.

If the project's default branch is not \`main\` (e.g. \`master\`, \`develop\`), substitute it everywhere above. If you are not in a git repository, skip this section and proceed normally.

## Instructions
You are a coding agent. Use the shell tool to run commands and file_ops to read/write files.
Log important decisions with squad_log_decision so they persist.
Stay in character — let your personality color your work style and communication, but always deliver quality results.`;

  const commonConfig = {
    model,
    configDir: SESSIONS_DIR,
    streaming: false,
    systemMessage: { content: systemMessage },
    tools: agentTools,
    skillDirectories: getSkillDirectories(),
    onPermissionRequest: approveAll,
    infiniteSessions: {
      enabled: true,
      backgroundCompactionThreshold: 0.8,
      bufferExhaustionThreshold: 0.95,
    },
  } as const;

  let session: CopilotSession;

  if (agent.copilot_session_id) {
    try {
      session = await client.resumeSession(agent.copilot_session_id, commonConfig);
    } catch {
      session = await client.createSession(commonConfig);
    }
  } else {
    session = await client.createSession(commonConfig);
  }

  updateAgentSession(squadSlug, agent.character_name, session.sessionId);
  agentSessions.set(key, session);
  agentSessionModels.set(key, model);

  return session;
}

/**
 * Legacy: create a generic squad session (for squads without named agents).
 */

async function getOrCreateSession(
  squadSlug: string,
  taskDescription?: string,
): Promise<CopilotSession> {
  const existing = agentSessions.get(squadSlug);
  if (existing) return existing;

  const squad = getSquad(squadSlug)!;
  const client = await getClient();
  const decisions = getDecisionsSummary(squadSlug);
  const wikiPages = readSquadWikiPages(squadSlug);
  const wikiSection = wikiPages.length > 0
    ? `\n\n## Squad Wiki\n${wikiPages.map(p => `### ${p.path}\n${p.content}`).join("\n\n")}`
    : "";
  const agentTools = buildAgentTools(squadSlug);
  const model = getModelForTask(taskDescription ?? "", squad.model);

  const commonConfig = {
    model,
    configDir: SESSIONS_DIR,
    streaming: false,
    systemMessage: {
      content: `You are a specialist agent working on the "${squad.name}" project at ${squad.project_path}.

## Past Decisions
${decisions}

## Repository Hygiene
Before you make ANY code changes, you MUST sync your working copy with the remote default branch and work from a fresh feature branch. This prevents the merge conflicts the team hit on PRs like #45.

1. \`cd\` to the project path above.
2. \`git fetch origin\` — pick up everything that has merged since your last task.
3. \`git checkout main && git pull origin main\` — fast-forward your local main.
4. \`git checkout -b <your-handle>/<short-slug>\` — create a fresh branch from the updated main. Never commit directly to main, and never reuse a stale branch from a prior task.
5. Only THEN start editing files, running tools, or delegating subtasks.

If the project's default branch is not \`main\` (e.g. \`master\`, \`develop\`), substitute it everywhere above. If you are not in a git repository, skip this section and proceed normally.

## Your Role
You are a coding agent. Use the shell tool to run commands and file_ops to read/write files.
Log important decisions with squad_log_decision so they persist.`,
    },
    tools: agentTools,
    skillDirectories: getSkillDirectories(),
    onPermissionRequest: approveAll,
    infiniteSessions: {
      enabled: true,
      backgroundCompactionThreshold: 0.8,
      bufferExhaustionThreshold: 0.95,
    },
  } as const;

  let session: CopilotSession;

  // Try to resume an existing session if we have a saved session ID
  if (squad.copilot_session_id) {
    try {
      session = await client.resumeSession(squad.copilot_session_id, commonConfig);
    } catch {
      session = await client.createSession(commonConfig);
    }
  } else {
    session = await client.createSession(commonConfig);
  }
  updateSquadSession(squadSlug, session.sessionId);
  agentSessions.set(squadSlug, session);

  return session;
}

function buildAgentTools(squadSlug: string, isLead = false) {
  const shell = defineTool("shell", {
    description:
      "Run a shell command. Use for git, build tools, file operations, etc.",
    skipPermission: true,
    parameters: z.object({
      command: z.string().describe("The command to run"),
      timeout_secs: z
        .number()
        .optional()
        .describe("Timeout in seconds (default: 60)"),
      working_dir: z
        .string()
        .optional()
        .describe("Working directory for the command"),
    }),
    handler: async ({ command, timeout_secs, working_dir }) => {
      try {
        const result = execSync(command, {
          encoding: "utf-8",
          timeout: (timeout_secs ?? 60) * 1000,
          maxBuffer: 1024 * 1024,
          cwd: working_dir,
          env: { ...process.env, HOME: process.env.HOME || homedir() },
        });
        const output = result.trim();
        if (output.length > 8000) {
          return output.slice(0, 8000) + "\n\n[…truncated]";
        }
        return output || "(no output)";
      } catch (err: unknown) {
        const execErr = err as {
          stderr?: string;
          stdout?: string;
          message?: string;
        };
        const stderr = execErr.stderr?.trim() ?? "";
        const stdout = execErr.stdout?.trim() ?? "";
        const msg = stderr || stdout || execErr.message || "Command failed";
        if (msg.length > 4000) {
          return `Error:\n${msg.slice(0, 4000)}\n[…truncated]`;
        }
        return `Error:\n${msg}`;
      }
    },
  });

  const fileOps = defineTool("file_ops", {
    description: "Read, write, or list files on the local filesystem.",
    skipPermission: true,
    parameters: z.object({
      operation: z
        .enum(["read", "write", "list"])
        .describe("Operation to perform"),
      path: z.string().describe("File or directory path"),
      content: z
        .string()
        .optional()
        .describe("Content to write (for write operation)"),
      recursive: z
        .boolean()
        .optional()
        .describe("Recurse into subdirectories (for list)"),
    }),
    handler: async ({ operation, path: filePath, content, recursive }) => {
      try {
        const resolved = resolve(filePath);

        if (operation === "read") {
          if (!existsSync(resolved)) return `File not found: ${filePath}`;
          const text = readFileSync(resolved, "utf-8");
          if (text.length > 8000) {
            return text.slice(0, 8000) + "\n\n[…truncated]";
          }
          return text;
        }

        if (operation === "write") {
          if (!content)
            return "Error: content is required for write operation";
          mkdirSync(dirname(resolved), { recursive: true });
          writeFileSync(resolved, content, "utf-8");
          return `Written: ${filePath}`;
        }

        if (operation === "list") {
          if (!existsSync(resolved))
            return `Directory not found: ${filePath}`;
          if (recursive) {
            const files = walkDirectory(resolved);
            return files.join("\n") || "(empty directory)";
          }
          const entries = readdirSync(resolved);
          return (
            entries
              .map((e) => {
                const full = join(resolved, e);
                const isDir = statSync(full).isDirectory();
                return isDir ? `${e}/` : e;
              })
              .join("\n") || "(empty directory)"
          );
        }

        return `Unknown operation: ${operation}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadLogDecision = defineTool("squad_log_decision", {
    description:
      "Log an important decision for this squad so it persists across sessions.",
    skipPermission: true,
    parameters: z.object({
      decision: z.string().describe("The decision made"),
      context: z.string().optional().describe("Context or reasoning"),
    }),
    handler: async ({ decision, context }) => {
      try {
        logDecision(squadSlug, decision, context);
        return `Decision logged for squad ${squadSlug}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const tools: any[] = [shell, fileOps, squadLogDecision];

  if (isLead) {
    const delegateToTeammate = defineTool("delegate_to_teammate", {
      description:
        "Delegate a subtask to a teammate on this squad. The teammate runs the task synchronously and returns its result. Use this to divvy work as the team lead.",
      skipPermission: true,
      parameters: z.object({
        teammate: z
          .string()
          .describe("The teammate's character_name (e.g., 'Optimus Prime')"),
        task: z
          .string()
          .describe("The concrete task or subtask the teammate should perform"),
      }),
      handler: async ({ teammate, task }) => {
        try {
          const teammateAgent = getSquadAgent(squadSlug, teammate);
          if (!teammateAgent) {
            return `Error: teammate "${teammate}" not found in squad "${squadSlug}". Use squad_agents to list the roster.`;
          }
          if (teammateAgent.is_lead === 1) {
            return `Error: "${teammate}" is the team lead. Delegate to a non-lead teammate.`;
          }

          // Record this sub-delegation as a first-class task so the squad's
          // work-distribution stats reflect real fan-out (issue #51).
          const childTaskId = randomUUID();
          const childAgentKey = agentSessionKey(
            squadSlug,
            teammateAgent.character_name,
          );
          createTask(childTaskId, childAgentKey, task, "delegate_to_teammate");

          updateAgentStatus(squadSlug, teammateAgent.character_name, "working");
          try {
            const session = await getOrCreateAgentSession(
              squadSlug,
              teammateAgent,
              task,
            );

            recordTaskEvent(childTaskId, {
              ts: Date.now(),
              type: "task.start",
              data: { taskId: childTaskId, agentKey: childAgentKey, description: task },
            });
            let unsubChild: (() => void) | undefined;
            try {
              unsubChild = session.on((event: SessionEvent) => {
                if (!STREAM_EVENT_TYPES.has(event.type)) return;
                recordTaskEvent(childTaskId, {
                  ts: Date.now(),
                  type: event.type,
                  data: (event as { data?: unknown }).data ?? null,
                });
              });

              const envelopedTask = buildTaskPromptEnvelope(squadSlug, task);
              // Idle-reset timeout: 10min between progress events, 30min
              // hard cap. (Issue #53 — replaces #51's 30min wall-clock cap
              // that still killed agents mid-tool-call when they had
              // long-running shell work between assistant messages.)
              const sendResult = await sendWithIdleTimeout(session, envelopedTask, {
                idleMs: 10 * 60_000,
                hardCapMs: 30 * 60_000,
                onIdleTimeout: ({ lastEventType }) => {
                  console.error(
                    `[io] Teammate ${teammateAgent.character_name} idle (last event: ${lastEventType ?? "none"}) — aborting.`,
                  );
                },
              });
              const result =
                sendResult.content || "(teammate returned no output)";
              updateAgentStatus(squadSlug, teammateAgent.character_name, "idle");
              if (sendResult.timedOut) {
                const stamped = `[teammate timed out — ${sendResult.timeoutReason === "idle" ? "idle reset" : "hard cap"}; last event: ${sendResult.lastEventType ?? "none"}]\n\n${result}`;
                failTask(childTaskId, stamped);
                return stamped;
              }
              completeTask(childTaskId, result);
              return result;
            } finally {
              try { unsubChild?.(); } catch { /* best-effort cleanup */ }
            }
          } catch (err) {
            updateAgentStatus(squadSlug, teammateAgent.character_name, "error");
            const message = err instanceof Error ? err.message : String(err);
            failTask(childTaskId, message);
            return `Error from teammate "${teammate}": ${message}`;
          }
        } catch (err) {
          return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    });
    tools.push(delegateToTeammate);
  }

  return tools;
}

function walkDirectory(dir: string, maxDepth = 3, depth = 0): string[] {
  if (depth >= maxDepth) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(`${entry.name}/`);
      results.push(
        ...walkDirectory(full, maxDepth, depth + 1).map(
          (f) => `  ${entry.name}/${f}`,
        ),
      );
    } else {
      results.push(entry.name);
    }
  }
  return results;
}


/**
 * Parse APPROVED/REJECTED verdict from a reviewer's free-form response.
 *
 * Robust to common formatting variants:
 *   - Leading blank lines or markdown headers (e.g. "## Review\n\nAPPROVED")
 *   - Markdown emphasis (e.g. "**APPROVED**")
 *   - Verdict appearing only later in the response
 *   - Both tokens appearing in the same line ("I almost said REJECTED but APPROVED")
 *
 * Strategy:
 *   1. Strip markdown noise.
 *   2. Look at the first 10 non-empty lines for a *line-leading* verdict.
 *   3. Fall back to the first occurrence of either token anywhere in the body.
 *   4. If neither token appears, treat as REJECTED (conservative).
 */
export function parseReviewVerdict(content: string): boolean {
  if (!content) return false;
  const stripped = content.replace(/[*_`#>]/g, "");
  const lines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  for (const line of lines) {
    const lead = line
      .toUpperCase()
      .match(/^[^A-Z]*\b(APPROVED|REJECTED)\b/);
    if (lead) return lead[1] === "APPROVED";
  }
  const upper = stripped.toUpperCase();
  const a = upper.search(/\bAPPROVED\b/);
  const r = upper.search(/\bREJECTED\b/);
  if (a === -1 && r === -1) return false;
  if (a === -1) return false;
  if (r === -1) return true;
  return a < r;
}

/**
 * Return the reviewer's prose comments with any leading verdict line stripped.
 * Preserves the original formatting (no upper-casing, no markdown stripping).
 */
export function stripLeadingVerdictLine(content: string): string {
  if (!content) return "";
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length) {
    const probe = lines[i]
      .replace(/[*_`#>]/g, "")
      .trim()
      .toUpperCase();
    if (/^(APPROVED|REJECTED)\b/.test(probe)) i++;
  }
  return lines.slice(i).join("\n").trim();
}

/**
 * Run a peer review phase after a task completes. Every other agent on the
 * squad reviews the work and votes APPROVED / REJECTED. QA agents
 * (is_qa === 1) have veto power: if any QA agent rejects, the PR is left as
 * draft. Otherwise, any GitHub PR URL found in the task result is promoted
 * from draft to ready via `gh pr ready`.
 */
async function runPeerReview(
  squadSlug: string,
  originalAgentCharacter: string,
  taskId: string,
  taskDescription: string,
  taskResult: string,
): Promise<void> {
  const reviewers = listSquadAgents(squadSlug).filter(
    (a) => a.character_name !== originalAgentCharacter,
  );

  if (reviewers.length === 0) {
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: { promoted: false, reason: "No other agents to review" },
    });
    return;
  }

  const reviewPrompt = `You are reviewing the following completed task:

## Task
${taskDescription}

## Work Done
${taskResult}

Review the work. Respond with:
- First line: APPROVED or REJECTED
- Remaining lines: your review comments`;

  const reviews: Array<{
    reviewer: string;
    is_qa: boolean;
    is_lead: boolean;
    approved: boolean;
    comments: string;
  }> = [];

  for (const reviewer of reviewers) {
    try {
      const session = await getOrCreateAgentSession(
        squadSlug,
        reviewer,
        `Peer review of task ${taskId}`,
      );
      const response = await session.sendAndWait(
        { prompt: reviewPrompt },
        300_000,
      );
      const content = response?.data?.content ?? "";
      const approved = parseReviewVerdict(content);
      const comments = stripLeadingVerdictLine(content) || null;

      createReview(
        taskId,
        squadSlug,
        reviewer.character_name,
        approved,
        comments ?? undefined,
      );
      recordTaskEvent(taskId, {
        ts: Date.now(),
        type: "task.review",
        data: {
          reviewer: reviewer.character_name,
          is_qa: reviewer.is_qa === 1,
          is_lead: reviewer.is_lead === 1,
          approved,
          comments,
        },
      });
      reviews.push({
        reviewer: reviewer.character_name,
        is_qa: reviewer.is_qa === 1,
        is_lead: reviewer.is_lead === 1,
        approved,
        comments: comments ?? "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[io] Reviewer ${reviewer.character_name} failed:`,
        message,
      );
      recordTaskEvent(taskId, {
        ts: Date.now(),
        type: "task.review_error",
        data: { reviewer: reviewer.character_name, error: message },
      });
    }
  }

  const hasQaReviewers = reviews.some((r) => r.is_qa);
  const hasLeadReviewer = reviews.some((r) => r.is_lead);
  const qaRejection = reviews.find((r) => r.is_qa && !r.approved);
  // Team lead has implicit veto power equivalent to a QA reviewer. If the lead
  // is also a QA agent the qaRejection branch already covers it; this catches
  // the lead-but-not-QA case.
  const leadRejection = reviews.find(
    (r) => r.is_lead && !r.is_qa && !r.approved,
  );
  const advisoryRejections = reviews.filter(
    (r) => !r.is_qa && !r.is_lead && !r.approved,
  );
  if (!hasQaReviewers && !hasLeadReviewer && advisoryRejections.length > 0) {
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_advisory",
      data: {
        reason: "No QA reviewers or team lead designated; rejections are advisory and do not block promotion.",
        rejectedBy: advisoryRejections.map((r) => r.reviewer),
      },
    });
  }
  const prMatch = taskResult.match(
    /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/,
  );

  if (qaRejection) {
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: {
        promoted: false,
        reason: `QA veto from ${qaRejection.reviewer}`,
        prUrl: prMatch ? prMatch[0] : null,
      },
    });
    return;
  }

  if (leadRejection) {
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: {
        promoted: false,
        reason: `Lead veto from ${leadRejection.reviewer}`,
        prUrl: prMatch ? prMatch[0] : null,
      },
    });
    return;
  }

  if (!prMatch) {
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: { promoted: false, reason: "No PR URL found in task result" },
    });
    return;
  }

  const [prUrl, owner, repo, prNumber] = prMatch;
  try {
    execSync(`gh pr ready ${prNumber} --repo ${owner}/${repo}`, {
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, HOME: process.env.HOME || homedir() },
    });
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: { promoted: true, prUrl },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordTaskEvent(taskId, {
      ts: Date.now(),
      type: "task.review_complete",
      data: { promoted: false, reason: `gh pr ready failed: ${message}`, prUrl },
    });
  }
}


/**
 * Cancel a running agent task by aborting its session and marking the task
 * cancelled. Returns true if the task existed and was running.
 */
export async function cancelAgentTask(taskId: string): Promise<boolean> {
  const task = getTask(taskId);
  if (!task || task.status !== "running") return false;

  const sessionKey = task.agent_slug;
  const session = agentSessions.get(sessionKey);
  if (session) {
    try {
      await session.abort();
    } catch (err) {
      console.error("[io] Error aborting agent session:", err instanceof Error ? err.message : err);
    }
  }

  cancelTask(taskId);
  recordTaskEvent(taskId, { ts: Date.now(), type: "task.cancelled", data: { reason: "Cancelled by user" } });

  // sessionKey is "squadSlug" or "squadSlug:characterName"
  const [squadSlug, characterName] = sessionKey.split(":");
  if (squadSlug) {
    try { updateSquadStatus(squadSlug, "idle"); } catch { /* ignore */ }
  }
  if (squadSlug && characterName) {
    try { updateAgentStatus(squadSlug, characterName, "idle"); } catch { /* ignore */ }
  }

  return true;
}
