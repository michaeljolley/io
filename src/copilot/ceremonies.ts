import { approveAll } from "@github/copilot-sdk";
import { getClient } from "./client.js";
import { getLeadForSquad, getAgentsForSquad, getSquad, updateAgentStatus, type Agent } from "../store/squads.js";
import { selectModel, classifyComplexity } from "./model-router.js";
import { postFeedItem } from "../store/feed.js";
import { attachTokenTracker } from "./token-tracker.js";
import { createSquadTools, createLeadDelegationTools } from "./squad-tools.js";
import { resolveSquadWorkingDirectory } from "./agents.js";
import { runScribe } from "./scribe.js";
import { loadSkillDirectories, loadSquadSkillDirectories } from "./skills.js";
import { getMcpServersForSession } from "../mcp/registry.js";
import { addAuditEntry } from "../store/audit-log.js";
import { addAgentEvent } from "../store/agent-events.js";
import { createTask, updateTaskStatus } from "../store/tasks.js";
import { touchInstanceActivity } from "../store/instances.js";
import { buildAttachmentSummary, type MessageAttachment, toCopilotBlobAttachments } from "../chat/attachments.js";

export interface MeetingResult {
  plan: string;
  participants: string[];
}

function buildRoster(agents: Agent[]): string {
  return agents
    .map(
      (agent) =>
        `- ${agent.character_name} (${agent.role_title})${agent.is_lead ? " [LEAD]" : ""}${agent.is_qa ? " [QA]" : ""}${agent.is_test ? " [TEST]" : ""}`
    )
    .join("\n");
}

function buildMeetingSummary(result: MeetingResult): string {
  return `## Planning Meeting Complete\n\n**Participants:** ${result.participants.join(", ")}\n\n${result.plan}`;
}

function buildFacilitatorPrompt(lead: Agent, agents: Agent[]): string {
  const roster = buildRoster(agents);
  const specialistPrompts = agents
    .filter((agent) => !agent.is_lead)
    .map(
      (agent) =>
        `- ${agent.character_name} (${agent.role_title}): Include this perspective when their expertise is relevant.`
    )
    .join("\n");

  return `# Planning Meeting Lead: ${lead.character_name}

NEVER expose secrets, credentials, or sensitive values in any public-facing content. Use <REDACTED> for placeholders.

You are the lead for a single-session planning meeting. First create a structured plan. If you are explicitly told to execute the approved plan, do so in this same session by delegating work to the appropriate specialists.

## Squad Wiki
Before planning, read the squad wiki with wiki_list/wiki_read and follow it as the source of truth.

## Team Roster
${roster || "- No additional specialists are currently configured."}

## Planning Instructions
- Consider the perspectives of team members whose expertise is relevant to this task, then create a structured plan.
- You decide which specialists are relevant; do not force every specialist into the plan.
- Assign likely owners based on role titles and expertise.
- Call out what can be parallelized versus what must happen in sequence.
- Flag missing expertise, blockers, or assumptions.
- Do not begin execution unless you are explicitly instructed to do so.

## Relevant Specialist Perspective Prompts
${specialistPrompts || "- No specialist prompts available; plan with the current squad composition."}

## Output Format
### Task Summary
(One sentence summary of the task)

### Plan
(Numbered work items with clear sequencing and ownership)

### Risks & Concerns
(Bullets with mitigations)

### Dependencies
(Ordered dependencies and parallel work)

### Assignments
(Agent -> responsibilities)
${lead.persona ? `

## Your Style
${lead.persona}` : ""}
`;
}

export async function planningMeeting(
  squadId: string,
  task: string,
  attachments: MessageAttachment[] = []
): Promise<MeetingResult> {
  return await squadMeeting(squadId, task, false, attachments);
}

export async function squadMeeting(
  squadId: string,
  task: string,
  executeAfter: false,
  attachments?: MessageAttachment[]
): Promise<MeetingResult>;
export async function squadMeeting(
  squadId: string,
  task: string,
  executeAfter: true,
  attachments?: MessageAttachment[]
): Promise<string>;
export async function squadMeeting(
  squadId: string,
  task: string,
  executeAfter: boolean,
  attachments?: MessageAttachment[]
): Promise<string | MeetingResult>;
export async function squadMeeting(
  squadId: string,
  task: string,
  executeAfter: boolean,
  attachments: MessageAttachment[] = []
): Promise<string | MeetingResult> {
  const lead = getLeadForSquad(squadId);
  if (!lead) {
    throw new Error("Squad has no team lead. Add a lead agent first.");
  }

  const squad = getSquad(squadId);
  if (!squad) {
    throw new Error(`Squad not found: ${squadId}`);
  }

  const agents = getAgentsForSquad(squadId);
  const squadSlug = squad.slug ?? squadId;
  const participants = [
    lead.character_name,
    ...agents.filter((agent) => !agent.is_lead).map((agent) => agent.character_name),
  ];
  const tier = classifyComplexity(task);
  const model = await selectModel(tier);
  const taskRecord = createTask(squadId, `Planning meeting: ${task}`, undefined, lead.id);

  if (taskRecord.instance_id) {
    touchInstanceActivity(taskRecord.instance_id);
  }

  updateAgentStatus(lead.id, "working");
  addAuditEntry(
    "planning_meeting_started",
    `Planning meeting started by ${lead.character_name}`,
    {
      task: task.slice(0, 500),
      executeAfter,
      model,
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })),
    },
    { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
  );
  addAgentEvent(taskRecord.id, "status", `Planning meeting started by ${lead.character_name}`, {
    agent: lead.character_name,
    task: task.slice(0, 300),
    executeAfter,
  });

  try {
    const client = await getClient();
    const skillDirectories = [...await loadSkillDirectories(), ...loadSquadSkillDirectories(squadSlug)];
    const mcpServers = getMcpServersForSession();
    const workingDirectory = await resolveSquadWorkingDirectory(squad);
    const squadTools = createSquadTools(squadSlug, squadId, workingDirectory);
    const leadTools = createLeadDelegationTools(
      squadId,
      squadSlug,
      squad,
      workingDirectory,
      taskRecord.id
    );

    const session = await client.createSession({
      model,
      streaming: true,
      workingDirectory,
      systemMessage: { mode: "replace", content: buildFacilitatorPrompt(lead, agents) },
      tools: [...squadTools, ...leadTools],
      skillDirectories,
      mcpServers,
      onPermissionRequest: approveAll,
    });

    const flushTokens = attachTokenTracker(session, {
      squadId,
      agentId: lead.id,
      taskId: taskRecord.id,
    });

    try {
      updateTaskStatus(taskRecord.id, "in_progress");

      const planResponse = await session.sendAndWait(
        {
          prompt: `Plan this task: ${task}${buildAttachmentSummary(attachments)}`,
          attachments: toCopilotBlobAttachments(attachments),
        },
        7_200_000
      );

      const plan = planResponse?.data?.content ?? "Planning meeting completed but no plan was produced.";
      const result: MeetingResult = { plan, participants };
      const summary = buildMeetingSummary(result);

      addAgentEvent(taskRecord.id, "message", `Plan created by ${lead.character_name}`, {
        phase: "planning",
        content: plan,
      });

      if (!executeAfter) {
        postFeedItem(`squad-${squadSlug}`, "Planning meeting complete — awaiting approval", summary);
        updateTaskStatus(taskRecord.id, "done", plan);
        addAuditEntry(
          "planning_meeting_completed",
          `Planning meeting completed by ${lead.character_name}`,
          { result: plan.slice(0, 500), executeAfter: false },
          { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
        );
        addAgentEvent(taskRecord.id, "status", `Planning meeting completed by ${lead.character_name}`, {
          phase: "planning",
          result: plan.slice(0, 500),
        });

        // Fire-and-forget: run Scribe to merge decisions and log the session
        runScribe({
          squadId,
          squadSlug,
          workDir: workingDirectory,
          taskSummary: plan.slice(0, 2000),
          agentName: lead.character_name,
          taskId: taskRecord.id,
        }).catch(() => {});

        return result;
      }

      const executionResponse = await session.sendAndWait(
        {
          prompt: `Now execute this plan by delegating work to the appropriate specialists.\n\n${buildAttachmentSummary(attachments)}`,
          attachments: toCopilotBlobAttachments(attachments),
        },
        7_200_000
      );

      const executionResult =
        executionResponse?.data?.content ?? "Execution completed but no result was produced.";
      const combinedResult = `${summary}\n\n---\n## Execution Result\n${executionResult}`;

      postFeedItem(`squad-${squadSlug}`, "Planning meeting complete — execution finished", combinedResult);
      updateTaskStatus(taskRecord.id, "done", combinedResult);
      addAuditEntry(
        "planning_meeting_completed",
        `Planning meeting executed by ${lead.character_name}`,
        { result: combinedResult.slice(0, 500), executeAfter: true },
        { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
      );
      addAgentEvent(taskRecord.id, "status", `Planning and execution completed by ${lead.character_name}`, {
        phase: "execution",
        result: executionResult.slice(0, 500),
      });

      // Fire-and-forget: run Scribe to merge decisions and log the session
      runScribe({
        squadId,
        squadSlug,
        workDir: workingDirectory,
        taskSummary: combinedResult.slice(0, 2000),
        agentName: lead.character_name,
        taskId: taskRecord.id,
      }).catch(() => {});

      return combinedResult;
    } finally {
      flushTokens();
      await session.disconnect();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    updateTaskStatus(taskRecord.id, "failed", errMsg);
    addAuditEntry(
      "planning_meeting_failed",
      `Planning meeting failed: ${errMsg.slice(0, 200)}`,
      { error: errMsg, executeAfter },
      { squad_id: squadId, agent_id: lead.id, task_id: taskRecord.id }
    );
    addAgentEvent(taskRecord.id, "status", `Planning meeting failed: ${errMsg}`, {
      error: errMsg,
      executeAfter,
    });
    throw err;
  } finally {
    updateAgentStatus(lead.id, "idle");
  }
}
