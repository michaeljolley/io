import { createChildLogger } from '../../logging/logger.js';
import type { Agent } from '../agent.js';
import { getEventBus } from '../event-bus.js';
import type { SquadRuntime } from '../manager.js';
import type { Instance, InstanceTask } from './instance.js';
import { transitionInstance } from './instance.js';

const logger = () => createChildLogger('meeting');

export interface MeetingResult {
	consensus: boolean;
	tasks: InstanceTask[];
	log: string[];
	vetoReason?: string;
}

const MAX_ROUNDS = 5;

/**
 * Run a round-table meeting for an instance.
 * Protocol:
 * 1. Team Lead presents context
 * 2. Each agent speaks in round-robin order
 * 3. Agents respond to previous speakers
 * 4. Team Lead calls for consensus
 * 5. Veto members can block
 * 6. If blocked, discussion continues (up to MAX_ROUNDS)
 * 7. On consensus, Team Lead formalizes task list
 */
export async function runMeeting(params: {
	instance: Instance;
	runtime: SquadRuntime;
	objective: string;
}): Promise<MeetingResult> {
	const log = logger();
	const { instance, runtime, objective } = params;
	const meetingLog: string[] = [];

	await transitionInstance(instance.id, 'meeting');

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'instance:meeting_started',
		squadId: instance.squadId,
		instanceId: instance.id,
		data: { objective },
	});

	const teamLead = runtime.members.get('team-lead');
	if (!teamLead) throw new Error('No team lead available for meeting');

	// Get non-lead agents for discussion
	const participants = [...runtime.members.entries()].filter(([role]) => role !== 'team-lead');

	// Step 1: Team lead presents the objective
	const presentation = await teamLead.send(
		`You are starting a round-table meeting. Present the following objective to your team and ask for input:\n\nObjective: ${objective}\n\nProvide a brief summary of the work needed and what expertise is required. Then ask each team member for their perspective.`,
	);
	meetingLog.push(`[team-lead] ${presentation}`);

	await emitContribution(instance, 'team-lead', presentation);

	// Step 2-3: Round-robin discussion
	let round = 0;
	let consensusReached = false;
	let vetoReason: string | undefined;

	while (round < MAX_ROUNDS && !consensusReached) {
		round++;
		log.info({ instanceId: instance.id, round }, 'Meeting round');

		// Each participant speaks
		for (const [role, agent] of participants) {
			const context = meetingLog.slice(-5).join('\n\n');
			const response = await agent.send(
				`You are in a team meeting (round ${round}/${MAX_ROUNDS}). Here's the recent discussion:\n\n${context}\n\nProvide your professional input on the objective. Focus on your area of expertise. If you're QA, focus on testing concerns. If you have concerns, state them clearly.`,
			);
			meetingLog.push(`[${role}] ${response}`);
			await emitContribution(instance, role, response);
		}

		// Step 4: Team lead calls for consensus
		const consensusCheck = await teamLead.send(
			`The discussion so far:\n\n${meetingLog.slice(-participants.length - 1).join('\n\n')}\n\nBased on this discussion, do we have consensus to proceed? Consider all concerns raised. Reply with either:\n- "CONSENSUS: <brief summary of agreed plan>"\n- "NEED_DISCUSSION: <what needs to be resolved>"`,
		);
		meetingLog.push(`[team-lead] ${consensusCheck}`);

		if (consensusCheck.toUpperCase().includes('CONSENSUS:')) {
			// Step 5: Check veto members
			const vetoMembers = [...runtime.members.entries()].filter(([role]) => {
				const skill = runtime.skills.get(role);
				return skill?.veto;
			});

			let vetoed = false;
			for (const [role, agent] of vetoMembers) {
				if (role === 'team-lead') continue; // team lead already agreed
				const vetoCheck = await agent.send(
					`The team has reached consensus on the following plan:\n\n${consensusCheck}\n\nAs a veto-holding member, do you approve this plan? Reply with:\n- "APPROVE" if you agree\n- "VETO: <reason>" if you have critical concerns that must be addressed`,
				);

				if (vetoCheck.toUpperCase().includes('VETO:')) {
					vetoed = true;
					vetoReason = vetoCheck;
					meetingLog.push(`[${role}] VETO: ${vetoCheck}`);
					await emitVeto(instance, role, vetoCheck);
					break;
				}
				meetingLog.push(`[${role}] Approved`);
			}

			if (!vetoed) {
				consensusReached = true;
			}
		}
	}

	// Step 7: Formalize task list
	let tasks: InstanceTask[] = [];
	if (consensusReached) {
		const taskPlan = await teamLead.send(
			`Consensus reached. Now formalize the work into specific tasks. For each task, specify:\n1. A brief description\n2. Which team member role should do it\n\nFormat each task as: "TASK: <description> | ASSIGN: <role>"\n\nList all tasks needed to complete the objective.`,
		);
		meetingLog.push(`[team-lead] Task plan: ${taskPlan}`);
		tasks = parseTaskList(taskPlan, instance.id);
	}

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'instance:meeting_complete',
		squadId: instance.squadId,
		instanceId: instance.id,
		data: { consensus: consensusReached, taskCount: tasks.length, rounds: round },
	});

	instance.meetingLog = meetingLog;
	instance.tasks = tasks;

	log.info(
		{ instanceId: instance.id, consensus: consensusReached, tasks: tasks.length },
		'Meeting complete',
	);

	return { consensus: consensusReached, tasks, log: meetingLog, vetoReason };
}

/** Parse the team lead's task list into structured tasks */
function parseTaskList(taskPlan: string, instanceId: string): InstanceTask[] {
	const tasks: InstanceTask[] = [];
	const lines = taskPlan.split('\n');

	for (const line of lines) {
		const match = line.match(/TASK:\s*(.+?)\s*\|\s*ASSIGN:\s*(.+)/i);
		if (match) {
			tasks.push({
				id: crypto.randomUUID(),
				description: match[1].trim(),
				assignedTo: match[2].trim().toLowerCase().replace(/\s+/g, '-'),
				status: 'pending',
			});
		}
	}

	return tasks;
}

async function emitContribution(instance: Instance, role: string, content: string) {
	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'meeting:contribution',
		squadId: instance.squadId,
		instanceId: instance.id,
		agentRole: role,
		content: content.slice(0, 500),
	});
}

async function emitVeto(instance: Instance, role: string, reason: string) {
	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'meeting:veto',
		squadId: instance.squadId,
		instanceId: instance.id,
		agentRole: role,
		content: reason,
	});
}
