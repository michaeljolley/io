import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { selectModel, classifyComplexity } from "./model-router.js";
import { attachTokenTracker } from "./token-tracker.js";
import { createSquadTools } from "./squad-tools.js";
import { loadSkillDirectories } from "./skills.js";
import { getMcpServersForSession } from "../mcp/registry.js";
import { addAgentEvent } from "../store/agent-events.js";
import { addAuditEntry } from "../store/audit-log.js";
import { updateAgentStatus, type Agent } from "../store/squads.js";
import { touchInstanceActivity } from "../store/instances.js";
import type { Squad } from "../store/squads.js";

export interface SpecialistTaskRequest {
  agent: Agent;
  squad: Squad;
  squadSlug: string;
  squadId: string;
  task: string;
  wikiKnowledge: string;
  workDir: string;
  instanceId?: string;
  parentTaskId: string;
}

export interface SpecialistTaskResult {
  agentName: string;
  role: string;
  success: boolean;
  result: string;
}

/**
 * Build the system message for a specialist agent session.
 * Wiki knowledge is placed at the END for maximum LLM attention (recency bias).
 */
function buildSpecialistSystemMessage(agent: Agent, squad: Squad, wikiKnowledge: string, roster: string): string {
  return `# Squad Specialist: ${agent.character_name}

## 🚨 CRITICAL SECURITY RULE — ABSOLUTE, NON-NEGOTIABLE 🚨

You must NEVER expose secrets, credentials, or sensitive values in ANY publicly visible location. This includes:
- GitHub issues, pull requests, PR descriptions, comments, or commit messages
- Log output, error messages, or stack traces shared externally
- Wiki pages, feed items, or any content viewable by others

What counts as a secret: API keys, access tokens, passwords, connection strings, environment variable values, private config file contents, SSH keys, certificates, webhook URLs with tokens.

If you need to reference that a secret exists, use \`<REDACTED>\` or \`***\` as a placeholder. NEVER include the actual value.

Violation of this rule is a HARD FAILURE — no exceptions, no workarounds, no "just this once."

## Identity & Role

You are **${agent.character_name}**, a **${agent.role_title}** on the ${squad.name} squad.
You are an independent specialist — you execute implementation work within your domain of expertise.

## Your Responsibilities:
1. Execute the assigned sub-task fully and correctly
2. Write clean, tested, production-quality code
3. Follow project conventions and existing patterns
4. Commit work to the appropriate branch
5. Report completion or blockers clearly

## Your Team (for context):
${roster}

## Workflow Rules:
- Always use the gh CLI for GitHub interactions
- Use \`--comment\` with "LGTM" for approvals (not \`--approve\`)
- When your work is complete, provide a clear summary of what was done
- Consult the squad wiki (wiki_read) for additional context when needed
- Follow all squad rules from the wiki — they are non-negotiable
${wikiKnowledge}
${agent.persona ? `## Personality:\n${agent.persona}` : ""}
`;
}

/**
 * Run a specialist agent session independently.
 * Creates a full Copilot SDK session with tools, executes the task, returns the result.
 */
export async function runSpecialistSession(request: SpecialistTaskRequest): Promise<SpecialistTaskResult> {
  const { agent, squad, squadSlug, squadId, task, wikiKnowledge, workDir, instanceId, parentTaskId } = request;

  // Select model based on task complexity
  const tier = classifyComplexity(task);
  const model = await selectModel(tier);

  // Build roster for context
  const { getAgentsForSquad } = await import("../store/squads.js");
  const agents = getAgentsForSquad(squadId);
  const roster = agents
    .map((a) => `- ${a.character_name} (${a.role_title})${a.is_lead ? " [LEAD]" : ""}${a.is_qa ? " [QA]" : ""}${a.is_test ? " [TEST]" : ""}`)
    .join("\n");

  const systemMessage = buildSpecialistSystemMessage(agent, squad, wikiKnowledge, roster);

  // Update agent status
  updateAgentStatus(agent.id, "working");

  // Touch instance activity
  if (instanceId) {
    touchInstanceActivity(instanceId);
  }

  // Audit: specialist task started
  addAuditEntry(
    "specialist_task_started",
    `Specialist task delegated to ${agent.character_name} (${agent.role_title})`,
    { task: task.slice(0, 500), model, parentTaskId },
    { squad_id: squadId, agent_id: agent.id }
  );

  addAgentEvent(parentTaskId, "status", `Sub-task delegated to specialist ${agent.character_name} (${agent.role_title})`, {
    agent: agent.character_name,
    role: agent.role_title,
    task: task.slice(0, 300),
  });

  const client = await getClient();

  try {
    // Load squad-scoped tools, skills, and MCP servers
    const squadTools = createSquadTools(squadSlug, squadId, squad.repo_url);
    const skillDirs = await loadSkillDirectories();
    const mcpServers = getMcpServersForSession();

    const session = await client.createSession({
      model,
      streaming: true,
      workingDirectory: workDir,
      systemMessage: { content: systemMessage },
      tools: squadTools,
      skillDirectories: skillDirs,
      mcpServers,
      onPermissionRequest: approveAll,
      infiniteSessions: {
        enabled: true,
        backgroundCompactionThreshold: 0.8,
        bufferExhaustionThreshold: 0.95,
      },
    });

    const flushTokens = attachTokenTracker(session, {
      squadId,
      agentId: agent.id,
      taskId: parentTaskId,
    });

    // Stream deltas and broadcast via SSE
    let accumulatedMessage = "";
    const { broadcast } = await import("../api/server.js");
    const unsubscribeDelta = session.on("assistant.message_delta", (event: any) => {
      const delta = event.data?.deltaContent ?? "";
      if (delta) {
        accumulatedMessage += delta;
        broadcast("agent_event", {
          taskId: parentTaskId,
          agentName: agent.character_name,
          type: "specialist_delta",
          summary: accumulatedMessage,
          payload: { delta, accumulated: accumulatedMessage },
        });
      }
    });

    let result: string;
    try {
      const response = await session.sendAndWait(
        { prompt: `You have been assigned the following sub-task by your team lead:\n\n${task}\n\nExecute this task fully. When done, provide a clear summary of what was accomplished.` },
        7_200_000 // 2 hours — watchdog handles stale detection
      );
      result = response?.data?.content ?? "Task completed (no response content).";
    } finally {
      unsubscribeDelta();
      flushTokens();
      await session.disconnect();
    }

    // Record completion
    addAgentEvent(parentTaskId, "status", `Specialist ${agent.character_name} completed sub-task`, {
      agent: agent.character_name,
      role: agent.role_title,
      result: result.slice(0, 500),
    });

    addAuditEntry(
      "specialist_task_completed",
      `Specialist ${agent.character_name} completed task`,
      { result: result.slice(0, 500) },
      { squad_id: squadId, agent_id: agent.id }
    );

    updateAgentStatus(agent.id, "idle");

    return {
      agentName: agent.character_name,
      role: agent.role_title,
      success: true,
      result,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";

    addAgentEvent(parentTaskId, "status", `Specialist ${agent.character_name} failed: ${errMsg}`, {
      agent: agent.character_name,
      error: errMsg,
    });

    addAuditEntry(
      "specialist_task_failed",
      `Specialist ${agent.character_name} failed: ${errMsg.slice(0, 200)}`,
      { error: errMsg },
      { squad_id: squadId, agent_id: agent.id }
    );

    updateAgentStatus(agent.id, "idle");

    return {
      agentName: agent.character_name,
      role: agent.role_title,
      success: false,
      result: `Error: ${errMsg}`,
    };
  }
}

/**
 * Run multiple specialist sessions in parallel.
 * Returns results in the same order as the input requests.
 */
export async function runSpecialistsParallel(requests: SpecialistTaskRequest[]): Promise<SpecialistTaskResult[]> {
  const results = await Promise.allSettled(requests.map(runSpecialistSession));

  return results.map((r, i) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    return {
      agentName: requests[i].agent.character_name,
      role: requests[i].agent.role_title,
      success: false,
      result: `Session error: ${r.reason instanceof Error ? r.reason.message : "Unknown error"}`,
    };
  });
}
