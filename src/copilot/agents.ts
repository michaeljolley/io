import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { loadConfig } from "../config.js";
import { getLeadForSquad, getAgentsForSquad, updateAgentStatus, getSquad } from "../store/squads.js";
import { createTask, updateTaskStatus, getTask } from "../store/tasks.js";
import { touchInstanceActivity } from "../store/instances.js";
import { selectModel, classifyComplexity } from "./model-router.js";
import { postFeedItem } from "../store/feed.js";
import { attachTokenTracker } from "./token-tracker.js";
import { addAuditEntry } from "../store/audit-log.js";
import { addAgentEvent } from "../store/agent-events.js";
import { PATHS } from "../paths.js";

// Registry of active agent sessions keyed by task ID
const activeSessions = new Map<string, CopilotSession>();

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
  instanceId?: string
): Promise<string> {
  const lead = getLeadForSquad(squadId);
  if (!lead) {
    throw new Error("Squad has no team lead. Add a lead agent first.");
  }

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

  const systemMessage = `# Squad Team Lead: ${lead.character_name}

You are ${lead.character_name}, the team lead for this squad. Your role is STRICTLY coordination — you do NOT write code, tests, or implementation of any kind.

## Your Responsibilities:
1. Break down tasks into smaller pieces and delegate to specialists
2. Route work to the appropriate specialist based on their role
3. Coordinate reviews and approvals
4. Ensure quality gates are met
5. Report progress and blockers

## PROHIBITED — You must NEVER:
- Write, edit, or generate code directly
- Create or modify files in the repository
- Run build/test commands to fix code (only to verify status)
- Implement any part of a task yourself

If no suitable specialist exists for a sub-task, report that back — do NOT attempt it yourself.

## Your Team:
${agentRoster}

## Workflow Rules:
- Peer review: QA + Test + Lead have veto power
- Use \`--comment\` with "LGTM" for approvals (not \`--approve\`)
- Always use the gh CLI for GitHub interactions
- Merge criteria: all veto-capable members have posted approving comments + CI passes + no conflicts

${lead.persona ? `## Personality:\n${lead.persona}` : ""}
`;

  let result: string;
  try {
    const session = await client.createSession({
      model,
      streaming: true,
      workingDirectory: process.cwd(),
      systemMessage: { content: systemMessage },
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
        const response = await session.sendAndWait(
          { prompt: `Task delegated to you:\n\n${task}` },
          600_000
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
  const squad = getSquad(squadId);
  const squadSource = squad ? `squad-${squad.slug}` : `squad-${squadId}`;
  postFeedItem(
    squadSource,
    `Task completed by ${lead.character_name}`,
    result.slice(0, 2000)
  );

  return result;
}
