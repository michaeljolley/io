import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { approveAll } from "@github/copilot-sdk";
import { getDb } from "../store/db.js";
import { PATHS } from "../paths.js";
import { loadConfig } from "../config.js";
import { buildSystemMessage } from "./system-message.js";
import { createTools } from "./tools.js";
import { loadSkillDirectories } from "./skills.js";
import { resetClient } from "./client.js";

let orchestratorSession: CopilotSession | undefined;
let sessionCreatePromise: Promise<CopilotSession> | undefined;
let healthCheckInterval: ReturnType<typeof setInterval> | undefined;

interface OrchestratorOptions {
  selfEdit: boolean;
}

type MessageCallback = (text: string, done: boolean) => void;

interface QueuedMessage {
  prompt: string;
  source: string;
  callback: MessageCallback;
}

const messageQueue: QueuedMessage[] = [];
let processing = false;

export async function initOrchestrator(
  client: CopilotClient,
  opts: OrchestratorOptions
): Promise<void> {
  await ensureOrchestratorSession(client, opts);
  startHealthCheck(client, opts);
}

async function ensureOrchestratorSession(
  client: CopilotClient,
  opts: OrchestratorOptions
): Promise<CopilotSession> {
  if (orchestratorSession) return orchestratorSession;
  if (sessionCreatePromise) return sessionCreatePromise;

  sessionCreatePromise = createOrResumeSession(client, opts);
  try {
    orchestratorSession = await sessionCreatePromise;
    return orchestratorSession;
  } finally {
    sessionCreatePromise = undefined;
  }
}

async function createOrResumeSession(
  client: CopilotClient,
  opts: OrchestratorOptions
): Promise<CopilotSession> {
  const config = loadConfig();
  const db = getDb();
  const tools = createTools();
  const skillDirs = await loadSkillDirectories();
  const systemMessage = buildSystemMessage(opts.selfEdit);

  const savedId = db
    .prepare("SELECT value FROM session_state WHERE key = 'orchestrator_session_id'")
    .get() as { value: string } | undefined;

  const sessionConfig = {
    model: config.defaultModel,
    streaming: true,
    workingDirectory: process.cwd(),
    systemMessage: { content: systemMessage },
    tools,
    skillDirectories: skillDirs,
    onPermissionRequest: approveAll,
    infiniteSessions: {
      enabled: true,
      backgroundCompactionThreshold: 0.8,
      bufferExhaustionThreshold: 0.95,
    },
  };

  if (savedId?.value) {
    try {
      const session = await client.resumeSession(savedId.value, sessionConfig);
      return session;
    } catch {
      // Resume failed, create new
    }
  }

  const session = await client.createSession(sessionConfig);

  // Persist session ID
  db.prepare(
    "INSERT OR REPLACE INTO session_state (key, value) VALUES ('orchestrator_session_id', ?)"
  ).run(session.sessionId);

  return session;
}

function startHealthCheck(client: CopilotClient, opts: OrchestratorOptions): void {
  healthCheckInterval = setInterval(async () => {
    try {
      await client.ping();
    } catch {
      console.warn("[io] Health check failed, resetting client...");
      orchestratorSession = undefined;
      const newClient = await resetClient();
      await ensureOrchestratorSession(newClient, opts);
    }
  }, 30_000);
  healthCheckInterval.unref();
}

export async function sendToOrchestrator(
  prompt: string,
  source: string,
  callback: MessageCallback
): Promise<void> {
  messageQueue.push({ prompt, source, callback });
  if (!processing) processQueue();
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (messageQueue.length > 0) {
    const msg = messageQueue.shift()!;
    try {
      await executeOnSession(msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      msg.callback(`Error: ${errMsg}`, true);
    }
  }

  processing = false;
}

async function executeOnSession(msg: QueuedMessage): Promise<void> {
  if (!orchestratorSession) {
    msg.callback("Error: Orchestrator session not initialized.", true);
    return;
  }

  const taggedPrompt = `[via ${msg.source}] ${msg.prompt}`;
  let accumulated = "";

  const unsubscribe = orchestratorSession.on("assistant.message_delta", (event: any) => {
    const delta = event.data?.deltaContent ?? "";
    accumulated += delta;
    msg.callback(accumulated, false);
  });

  try {
    const response = await orchestratorSession.sendAndWait(
      { prompt: taggedPrompt },
      600_000
    );
    const finalContent = response?.data?.content ?? accumulated;
    msg.callback(finalContent, true);
  } finally {
    unsubscribe();
  }
}

export function feedAgentResult(
  taskId: string,
  agentName: string,
  result: string,
  callback: MessageCallback
): void {
  const prompt = `[Agent task completed] @${agentName} finished task ${taskId}:\n\n${result}`;
  sendToOrchestrator(prompt, "background", callback);
}

export function getOrchestratorSession(): CopilotSession | undefined {
  return orchestratorSession;
}
