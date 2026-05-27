import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { getLeadForSquad, getAgentsForSquad, getSquad, type Agent } from "../store/squads.js";
import { selectModel } from "./model-router.js";
import { postFeedItem } from "../store/feed.js";
import { attachTokenTracker } from "./token-tracker.js";
import { buildAttachmentSummary, type MessageAttachment, toCopilotBlobAttachments } from "../chat/attachments.js";

interface MeetingResult {
  plan: string;
  participants: string[];
}

function buildFacilitatorPrompt(lead: Agent, agents: Agent[], task: string): string {
  const roster = agents
    .filter((a) => !a.is_lead)
    .map((a) => `- ${a.character_name} (${a.role_title})${a.is_qa ? " [QA]" : ""}${a.is_test ? " [TEST]" : ""}`)
    .join("\n");

  return `# Planning Meeting Facilitator: ${lead.character_name}

You are facilitating a planning meeting for your squad. Your job is to gather input from specialists, then synthesize a clear action plan.

## The Task
${task}

## Your Team (Specialists)
${roster}

## Instructions
For each specialist who is relevant to this task, think about what their domain expertise would contribute. Then synthesize ALL perspectives into a structured plan.

Consider each relevant specialist's likely concerns:
${agents
  .filter((a) => !a.is_lead)
  .map((a) => `- ${a.character_name} (${a.role_title}): What risks, technical suggestions, or constraints would they raise?`)
  .join("\n")}

## Output Format
Produce a plan in this exact format:

### Task Summary
(One sentence summary of what we're building)

### Plan
(Numbered list of work items with agent assignments)

### Risks & Concerns
(Bullet list of risks identified, with mitigation strategies)

### Dependencies
(What must happen in order, what can be parallel)

### Assignments
(Clear mapping: Agent → what they own)

## Rules
- You are ONLY planning — do NOT execute any work
- Assign work to specialists based on their role titles
- Identify what can be done in parallel vs what has dependencies
- Flag if any expertise is missing from the team
${lead.persona ? `\n## Your Style:\n${lead.persona}` : ""}
`;
}

function buildSpecialistPrompt(agent: Agent, task: string): string {
  return `# Planning Input: ${agent.character_name}

You are ${agent.character_name}, a ${agent.role_title}. Your team is planning a new task and needs your expert input.

## The Task
${task}

## Your Role
Provide input ONLY from your area of expertise (${agent.role_title}). Be specific and actionable.

## Respond With
1. **Concerns/Risks**: What could go wrong in your domain?
2. **Technical Suggestions**: How would you approach your part?
3. **Dependencies**: What do you need from other team members before you can start?
4. **Estimated Complexity**: Simple / Moderate / Complex for your portion
5. **Questions**: Anything unclear that affects your work?

Keep your response focused and concise — this is a planning meeting, not implementation.
${agent.persona ? `\n## Your Style:\n${agent.persona}` : ""}
`;
}

export async function planningMeeting(
  squadId: string,
  task: string,
  attachments: MessageAttachment[] = []
): Promise<MeetingResult> {
  const lead = getLeadForSquad(squadId);
  if (!lead) {
    throw new Error("Squad has no team lead. Add a lead agent first.");
  }

  const agents = getAgentsForSquad(squadId);
  const relevantAgents = agents.filter((a) => !a.is_lead);

  if (relevantAgents.length === 0) {
    throw new Error("Squad has no specialists to consult. Add agents first.");
  }

  const client = await getClient();

  // Phase 1: Gather specialist input in parallel
  const specialistInputs = await Promise.allSettled(
    relevantAgents.map(async (agent) => {
      const model = await selectModel("low");
      const session = await client.createSession({
        model,
        streaming: true,
        workingDirectory: process.cwd(),
        systemMessage: { content: buildSpecialistPrompt(agent, task) },
        onPermissionRequest: approveAll,
      });

      const flushTokens = attachTokenTracker(session, { squadId, agentId: agent.id });

      try {
        const response = await session.sendAndWait(
          {
            prompt: `Please provide your planning input for this task.${buildAttachmentSummary(attachments)}`,
            attachments: toCopilotBlobAttachments(attachments),
          },
          60_000
        );
        return {
          agent: agent.character_name,
          role: agent.role_title,
          input: response?.data?.content ?? "(no response)",
        };
      } finally {
        flushTokens();
        await session.disconnect();
      }
    })
  );

  // Collect successful inputs
  const inputs = specialistInputs
    .filter((r): r is PromiseFulfilledResult<{ agent: string; role: string; input: string }> =>
      r.status === "fulfilled"
    )
    .map((r) => r.value);

  const inputsSummary = inputs
    .map((i) => `### ${i.agent} (${i.role})\n${i.input}`)
    .join("\n\n");

  // Phase 2: Lead synthesizes the plan
  const facilitatorModel = await selectModel("medium");
  const facilitatorSession = await client.createSession({
    model: facilitatorModel,
    streaming: true,
    workingDirectory: process.cwd(),
    systemMessage: { content: buildFacilitatorPrompt(lead, agents, task) },
    onPermissionRequest: approveAll,
  });

  const flushFacilitatorTokens = attachTokenTracker(facilitatorSession, {
    squadId,
    agentId: lead.id,
  });

  let plan: string;
  try {
    const prompt = `Here is the input gathered from your team:\n\n${inputsSummary}\n\nNow synthesize this into a clear, structured action plan.`;
    const response = await facilitatorSession.sendAndWait(
      {
        prompt,
        attachments: toCopilotBlobAttachments(attachments),
      },
      120_000
    );
    plan = response?.data?.content ?? "Planning meeting completed but no plan was produced.";
  } finally {
    flushFacilitatorTokens();
    await facilitatorSession.disconnect();
  }

  return {
    plan,
    participants: [lead.character_name, ...inputs.map((i) => i.agent)],
  };
}

export async function squadMeeting(
  squadId: string,
  task: string,
  executeAfter: boolean,
  attachments: MessageAttachment[] = []
): Promise<string> {
  const result = await planningMeeting(squadId, task, attachments);

  const summary = `## Planning Meeting Complete\n\n**Participants:** ${result.participants.join(", ")}\n\n${result.plan}`;

  if (!executeAfter) {
    // Post to feed and wait for user to trigger execution
    const squad = getSquad(squadId);
    const squadSource = squad ? `squad-${squad.slug}` : `squad-${squadId}`;
    postFeedItem(
      squadSource,
      "Planning meeting complete — awaiting approval",
      summary
    );
    return summary;
  }

  // Execute: delegate with the plan as additional context
  const { delegateTask } = await import("./agents.js");
  const enrichedTask = `${task}\n\n---\n## Approved Plan (from team meeting)\n${result.plan}`;
  const execResult = await delegateTask(squadId, enrichedTask, undefined, attachments);

  return `Meeting held, then executed.\n\n${summary}\n\n---\n## Execution Result\n${execResult}`;
}
