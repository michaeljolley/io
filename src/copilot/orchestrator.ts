import crypto from "node:crypto";
import {
  approveAll,
  type CopilotClient,
  type CopilotSession,
  type SessionConfig,
} from "@github/copilot-sdk";
import { config } from "../config.js";
import { SESSIONS_DIR, IO_VERSION } from "../paths.js";
import { getState, setState, deleteState, logConversation } from "../store/db.js";
import { clearStaleTasks, getAgentTaskStats, getSquadWorkDistribution, getStalestSpecialist, getTask, getTaskReviews } from "../store/tasks.js";
import {
  getSquad,
  listSquads,
  createSquad,
  deleteSquad,
  logDecision,
  getDecisions,
  getDecisionsSummary,
  updateSquadStatus,
  addSquadAgent,
  listSquadAgents,
  removeSquadAgent,
  updateAgentStatus,
  clearAgentSession,
  setSquadLead,
  getSquadLead,
  setSquadQA,
} from "../store/squads.js";
import { readPage, writePage, assertPagePath, deletePage, listPages } from "../wiki/fs.js";
import { resolveModelTiers } from "./model-router.js";
import { searchWiki, getWikiSummary } from "../wiki/search.js";
import { getOrchestratorSystemMessage } from "./system-message.js";
import { createTools } from "./tools.js";
import { getSkillDirectories, listSkills, installSkill, removeSkill, searchSkillsRegistry } from "./skills.js";
import { resetClient } from "./client.js";
import { delegateToAgent, getActiveAgentTasks, clearAgentInMemorySession } from "./agents.js";
import { saveConfig } from "../config.js";
import { checkForUpdate } from "../update.js";
import {
  createInstance,
  getInstance,
  listInstances,
  updateInstanceStatus,
  logInstanceDecision,
  getInstanceDecisions,
  mergeInstanceDecisions,
  deleteInstance,
  buildContextSnapshot,
  reconcileInstances,
  ensureInstanceTables,
} from "../store/instances.js";
import { createWorktree, removeWorktree } from "../store/worktrees.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageSource =
  | { type: "telegram"; chatId: number; messageId: number }
  | { type: "tui"; connectionId: string }
  | { type: "background" };

export type MessageCallback = (text: string, done: boolean) => void;

interface QueuedMessage {
  prompt: string;
  source: MessageSource;
  callback: MessageCallback;
  resolve: () => void;
  reject: (err: Error) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const SEND_TIMEOUT_MS = 600_000;
const MAX_RETRIES = 3;
const SESSION_ID_KEY = "orchestrator_session_id";
const SESSION_TOOLS_KEY = "orchestrator_session_tools";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let client: CopilotClient | undefined;
let orchestratorSession: CopilotSession | undefined;
let healthCheckTimer: ReturnType<typeof setInterval> | undefined;
let sessionInitPromise: Promise<CopilotSession> | undefined;
let clientResetPromise: Promise<CopilotClient> | undefined;
const messageQueue: QueuedMessage[] = [];
let processing = false;

// ---------------------------------------------------------------------------
// Session config helpers
// ---------------------------------------------------------------------------

function mapSquad(s: { slug: string; name: string; project_path: string; status: string; universe?: string | null }) {
  return { slug: s.slug, name: s.name, projectPath: s.project_path, status: s.status, universe: s.universe };
}

function getToolDeps() {
  return {
    wikiRead: readPage,
    wikiWrite: writePage,
    wikiSearch: searchWiki,
    wikiAssertPagePath: assertPagePath,
    wikiDelete: deletePage,
    wikiList: listPages,
    getSquad: (slug: string) => {
      const s = getSquad(slug);
      return s ? mapSquad(s) : undefined;
    },
    listSquads: () => listSquads().map(mapSquad),
    createSquad,
    deleteSquad,
    logDecision,
    getDecisionsSummary,
    getRecentDecisions: (slug: string, limit?: number) =>
      getDecisions(slug, limit ?? 5).map((d) => ({
        decision: d.decision,
        context: d.context,
        created_at: d.created_at,
      })),
    updateSquadStatus,
    delegateToAgent,
    getTask,
    getActiveAgentTasks: () =>
      getActiveAgentTasks().map((t) => ({
        taskId: t.taskId,
        agentSlug: t.agentSlug,
        description: t.description,
        status: t.status,
      })),
    addSquadAgent,
    listSquadAgents: (slug: string) =>
      listSquadAgents(slug).map((a) => ({
        character_name: a.character_name,
        role_title: a.role_title,
        charter: a.charter,
        model_tier: a.model_tier,
        personality: a.personality,
        status: a.status,
        is_lead: a.is_lead,
        is_qa: a.is_qa,
      })),
    removeSquadAgent,
    resetSquadAgent: (squadSlug: string, characterName: string) => {
      const agents = listSquadAgents(squadSlug);
      const target = agents.find((a) => a.character_name === characterName);
      if (!target) {
        return { found: false, previousStatus: "", agent: null };
      }
      const previousStatus = target.status;
      updateAgentStatus(squadSlug, characterName, "idle");
      clearAgentSession(squadSlug, characterName);
      clearAgentInMemorySession(squadSlug, characterName);
      return {
        found: true,
        previousStatus,
        agent: {
          character_name: target.character_name,
          role_title: target.role_title,
        },
      };
    },
    setSquadLead,
    getSquadLead: (slug: string) => {
      const lead = getSquadLead(slug);
      return lead
        ? { character_name: lead.character_name, role_title: lead.role_title }
        : undefined;
    },
    setSquadQA,
    getTaskReviews: (taskId: string) =>
      getTaskReviews(taskId).map((r) => ({
        reviewer_character: r.reviewer_character,
        approved: r.approved,
        comments: r.comments,
        squad_slug: r.squad_slug,
      })),
    getSquadWorkDistribution: (slug: string, limit?: number) =>
      getSquadWorkDistribution(slug, limit),
    getAgentTaskStats: (squadSlug: string, characterNames: string[]) =>
      getAgentTaskStats(squadSlug, characterNames),
    getStalestSpecialist: (
      squadSlug: string,
      characterNames: string[],
      options?: { excludeCharacters?: string[]; freshIfWithinHours?: number },
    ) => getStalestSpecialist(squadSlug, characterNames, options),
    listSkills,
    installSkill,
    removeSkill,
    searchSkillsRegistry,
    saveConfig,
    checkForUpdate,
    // Squad instance deps
    createInstance,
    getInstance,
    listInstances,
    updateInstanceStatus,
    logInstanceDecision,
    getInstanceDecisions,
    mergeInstanceDecisions,
    deleteInstance,
    buildContextSnapshot,
    reconcileInstances,
    createWorktree,
    removeWorktree,
  };
}

function getSessionConfig(): Pick<SessionConfig, "tools" | "skillDirectories"> {
  const tools = createTools(getToolDeps());
  return { tools, skillDirectories: getSkillDirectories() };
}

/** Hash of tool names + version — used to detect when tools change across updates. */
function toolFingerprint(tools: SessionConfig["tools"]): string {
  const names = (tools ?? []).map((t) => t.name).sort().join(",");
  return crypto.createHash("sha256").update(`${IO_VERSION}:${names}`).digest("hex").slice(0, 16);
}

function buildSquadRoster(): string {
  const squads = listSquads();
  if (squads.length === 0) return "";
  return squads
    .map((s) => {
      const agents = listSquadAgents(s.slug);
      const lead = agents.find((a) => a.is_lead === 1);
      const agentList = agents
        .map((a) => {
          const badges = [
            a.is_lead === 1 ? "⭐ LEAD" : "",
            a.is_qa === 1 ? "🛡️ QA" : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `  - ${a.character_name} (${a.role_title})${badges ? ` [${badges}]` : ""}`;
        })
        .join("\n");
      const leadLine = lead ? `\nTeam Lead: ${lead.character_name}` : "";
      return `**${s.name}** (\`${s.slug}\`) — ${s.status}\n📁 ${s.project_path}${leadLine}\n${agentList || "  _(no agents yet)_"}`;
    })
    .join("\n\n");
}

function buildFullSessionConfig(): SessionConfig {
  const { tools, skillDirectories } = getSessionConfig();
  return {
    model: config.defaultModel || "gpt-4.1",
    configDir: SESSIONS_DIR,
    streaming: true,
    systemMessage: {
      content: getOrchestratorSystemMessage({
        selfEditEnabled: config.selfEditEnabled,
        memorySummary: getWikiSummary() || undefined,
        squadRoster: buildSquadRoster() || undefined,
      }),
    },
    tools,
    skillDirectories,
    onPermissionRequest: approveAll,
    infiniteSessions: {
      enabled: true,
      backgroundCompactionThreshold: 0.80,
      bufferExhaustionThreshold: 0.95,
    },
  };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("disconnect") ||
    msg.includes("epipe") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("connection") ||
    msg.includes("socket")
  );
}

function isSessionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("session") ||
    msg.includes("closed") ||
    msg.includes("expired") ||
    msg.includes("not found")
  );
}

// ---------------------------------------------------------------------------
// Client management
// ---------------------------------------------------------------------------

async function ensureClient(): Promise<CopilotClient> {
  if (!client) {
    throw new Error("Orchestrator not initialized — call initOrchestrator first");
  }

  if (client.getState() === "connected") return client;

  // Coalesce concurrent reset attempts
  if (clientResetPromise) return clientResetPromise;

  clientResetPromise = (async () => {
    console.error("[io] Client disconnected, resetting…");
    try {
      const newClient = await resetClient();
      client = newClient;
      return newClient;
    } finally {
      clientResetPromise = undefined;
    }
  })();

  return clientResetPromise;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function ensureOrchestratorSession(): Promise<CopilotSession> {
  if (orchestratorSession) return orchestratorSession;

  // Coalesce concurrent session creation
  if (sessionInitPromise) return sessionInitPromise;

  sessionInitPromise = (async () => {
    try {
      const c = await ensureClient();
      const savedSessionId = getState(SESSION_ID_KEY);
      const savedToolsHash = getState(SESSION_TOOLS_KEY);
      const { tools, skillDirectories } = getSessionConfig();
      const currentToolsHash = toolFingerprint(tools);

      if (savedSessionId) {
        if (!savedToolsHash || savedToolsHash !== currentToolsHash) {
          console.error("[io] Tool set changed since last session — starting fresh");
          deleteState(SESSION_ID_KEY);
          deleteState(SESSION_TOOLS_KEY);
        } else {
          try {
            console.error("[io] Resuming session:", savedSessionId);
            const session = await c.resumeSession(savedSessionId, {
              configDir: SESSIONS_DIR,
              streaming: true,
              tools,
              skillDirectories,
              onPermissionRequest: approveAll,
              infiniteSessions: {
                enabled: true,
                backgroundCompactionThreshold: 0.80,
                bufferExhaustionThreshold: 0.95,
              },
            });
            orchestratorSession = session;
            setState(SESSION_TOOLS_KEY, currentToolsHash);
            return session;
          } catch (err) {
            console.error("[io] Failed to resume session, creating new one:", err instanceof Error ? err.message : err);
            deleteState(SESSION_ID_KEY);
            deleteState(SESSION_TOOLS_KEY);
          }
        }
      }

      console.error("[io] Creating new orchestrator session");
      const session = await c.createSession(buildFullSessionConfig());
      setState(SESSION_ID_KEY, session.sessionId);
      setState(SESSION_TOOLS_KEY, currentToolsHash);
      orchestratorSession = session;
      return session;
    } finally {
      sessionInitPromise = undefined;
    }
  })();

  return sessionInitPromise;
}

function invalidateSession(): void {
  orchestratorSession = undefined;
  sessionInitPromise = undefined;
}

// ---------------------------------------------------------------------------
// Message execution
// ---------------------------------------------------------------------------

async function executeOnSession(
  prompt: string,
  callback: MessageCallback,
): Promise<string> {
  const session = await ensureOrchestratorSession();

  let accumulated = "";
  const unsubDelta = session.on("assistant.message_delta", (event) => {
    const delta = event.data.deltaContent;
    accumulated += delta;
    callback(delta, false);
  });

  try {
    const result = await session.sendAndWait({ prompt }, SEND_TIMEOUT_MS);
    unsubDelta();

    const finalText = result?.data.content ?? accumulated;
    callback("", true);
    return finalText;
  } catch (err) {
    unsubDelta();

    // If we accumulated partial text, return it gracefully on timeout
    if (accumulated && err instanceof Error && err.message.includes("timeout")) {
      console.error("[io] Session sendAndWait timed out, returning partial response");
      callback("", true);
      return accumulated;
    }

    // Session-level errors: invalidate and let caller retry
    if (isSessionError(err)) {
      console.error("[io] Session error, invalidating:", err instanceof Error ? err.message : err);
      invalidateSession();
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------

function sourceTag(source: MessageSource): string {
  switch (source.type) {
    case "telegram":
      return "[via telegram]";
    case "tui":
      return "[via tui]";
    case "background":
      return "[via background]";
  }
}

function sourceLabel(source: MessageSource): string {
  switch (source.type) {
    case "telegram":
      return "telegram";
    case "tui":
      return "tui";
    case "background":
      return "background";
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      const taggedPrompt = `${sourceTag(msg.source)} ${msg.prompt}`;
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await executeOnSession(taggedPrompt, msg.callback);
          logConversation("assistant", response, sourceLabel(msg.source));
          msg.resolve();
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.error(`[io] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

          if (isConnectionError(err)) {
            // Reset client and invalidate session for connection errors
            invalidateSession();
            try {
              await ensureClient();
            } catch (resetErr) {
              console.error("[io] Client reset failed:", resetErr instanceof Error ? resetErr.message : resetErr);
            }
          } else if (isSessionError(err)) {
            // Session already invalidated in executeOnSession
          } else if (attempt === MAX_RETRIES) {
            // Non-retryable error on last attempt
            break;
          }
        }
      }

      if (lastError) {
        const errorMsg = `Sorry, I encountered an error: ${lastError.message}`;
        msg.callback(errorMsg, true);
        msg.reject(lastError);
      }
    }
  } finally {
    processing = false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initOrchestrator(copilotClient: CopilotClient): Promise<void> {
  client = copilotClient;

  ensureInstanceTables();
  const reconciledInstances = reconcileInstances();
  if (reconciledInstances > 0) {
    console.error(`[orchestrator] Reconciled ${reconciledInstances} stale instance(s) on startup`);
  }
  clearStaleTasks();

  // Validate the configured model and resolve model tiers
  try {
    const models = await copilotClient.listModels();
    const defaultModel = config.defaultModel || "gpt-4.1";
    const modelIds = models.map((m) => m.id);
    if (!modelIds.includes(defaultModel)) {
      console.error(
        `[io] Configured model "${defaultModel}" not found. Available: ${modelIds.join(", ")}`,
      );
    } else {
      console.error(`[io] Model validated: ${defaultModel}`);
    }
    resolveModelTiers(modelIds);
  } catch (err) {
    console.error("[io] Could not validate models:", err instanceof Error ? err.message : err);
  }

  // Log built-in tools for diagnostics
  try {
    const toolsList = await copilotClient.rpc.tools.list({});
    const toolNames = toolsList.tools.map((t: { name: string }) => t.name);
    console.error(`[io] Built-in tools: ${toolNames.join(", ")}`);
  } catch { /* non-fatal */ }

  // Start health check timer
  healthCheckTimer = setInterval(() => {
    if (!client || client.getState() !== "connected") {
      console.error("[io] Health check: client disconnected, reconnecting…");
      ensureClient().catch((err) => {
        console.error("[io] Health check reconnect failed:", err instanceof Error ? err.message : err);
      });
      invalidateSession();
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // Eagerly create/resume the session
  try {
    await ensureOrchestratorSession();
    console.error("[io] Orchestrator session ready");
  } catch (err) {
    console.error("[io] Eager session creation failed (will retry on first message):", err instanceof Error ? err.message : err);
  }
}

export async function sendToOrchestrator(
  prompt: string,
  source: MessageSource,
  callback: MessageCallback,
): Promise<void> {
  logConversation("user", prompt, sourceLabel(source));

  return new Promise<void>((resolve, reject) => {
    messageQueue.push({ prompt, source, callback, resolve, reject });
    processQueue();
  });
}

export async function shutdownOrchestrator(): Promise<void> {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = undefined;
  }

  if (orchestratorSession) {
    try {
      await orchestratorSession.disconnect();
    } catch (err) {
      console.error("[io] Error disconnecting session:", err instanceof Error ? err.message : err);
    }
    orchestratorSession = undefined;
  }

  sessionInitPromise = undefined;
  clientResetPromise = undefined;
  client = undefined;
}

/**
 * Abort the orchestrator's current in-flight request. The session remains valid
 * for subsequent prompts. Returns true if a session existed and abort was
 * attempted, false otherwise.
 */
export async function abortOrchestrator(): Promise<boolean> {
  if (!orchestratorSession) return false;
  try {
    await orchestratorSession.abort();
    return true;
  } catch (err) {
    console.error("[io] Error aborting orchestrator session:", err instanceof Error ? err.message : err);
    return false;
  }
}
