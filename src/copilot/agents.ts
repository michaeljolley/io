import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { loadConfig } from "../config.js";
import { getLeadForSquad, getAgentsForSquad, updateAgentStatus, getSquad } from "../store/squads.js";
import { createTask, updateTaskStatus } from "../store/tasks.js";
import { touchInstanceActivity } from "../store/instances.js";
import { selectModel, classifyComplexity } from "./model-router.js";
import { postFeedItem } from "../store/feed.js";
import { PATHS } from "../paths.js";

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

    try {
      const response = await session.sendAndWait(
        { prompt: `Task delegated to you:\n\n${task}` },
        600_000
      );
      result = response?.data?.content ?? "Task completed (no response content).";
    } finally {
      await session.disconnect();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    updateTaskStatus(taskRecord.id, "failed", errMsg);
    updateAgentStatus(lead.id, "idle");
    throw err;
  }

  // Update task and agent status
  updateTaskStatus(taskRecord.id, "done", result);
  updateAgentStatus(lead.id, "idle");

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
