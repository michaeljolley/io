import { createChildLogger } from '../../logging/logger.js';
import type { Agent } from '../agent.js';
import { getEventBus } from '../event-bus.js';
import type { SquadRuntime } from '../manager.js';
import { type Instance, type InstanceTask, transitionInstance } from './instance.js';

const logger = () => createChildLogger('task-exec');

/**
 * Execute all tasks in an instance sequentially.
 * Team lead reviews each completed task before moving to the next.
 */
export async function executeTasks(params: {
	instance: Instance;
	runtime: SquadRuntime;
}): Promise<void> {
	const log = logger();
	const { instance, runtime } = params;

	await transitionInstance(instance.id, 'working');

	const teamLead = runtime.members.get('team-lead');
	if (!teamLead) throw new Error('No team lead for task execution');

	for (const task of instance.tasks) {
		if (task.status === 'done') continue;

		log.info({ taskId: task.id, assignedTo: task.assignedTo }, 'Executing task');
		task.status = 'in_progress';

		const agent = runtime.members.get(task.assignedTo);
		if (!agent) {
			log.warn({ role: task.assignedTo }, 'No agent for assigned role, team lead will handle');
			// Reassign to team lead for delegation decision
			task.result = `No agent with role '${task.assignedTo}' available.`;
			task.status = 'failed';
			continue;
		}

		try {
			// Agent executes the task
			const workingDir = instance.worktree?.path ?? '';
			const taskPrompt = buildTaskPrompt(task, workingDir, instance);

			const result = await agent.send(taskPrompt);
			task.result = result;

			// Team lead reviews
			const review = await teamLead.send(
				`An agent (${task.assignedTo}) completed a task. Review their work:\n\nTask: ${task.description}\n\nAgent's report:\n${result.slice(0, 2000)}\n\nIs this satisfactory? Reply with:\n- "APPROVED" if the work meets requirements\n- "REDO: <feedback>" if it needs changes`,
			);

			if (review.toUpperCase().includes('APPROVED')) {
				task.status = 'done';
				log.info({ taskId: task.id }, 'Task approved');
			} else if (review.toUpperCase().includes('REDO:')) {
				// Give agent one more attempt with feedback
				const feedback = review.replace(/^.*REDO:\s*/i, '');
				const retry = await agent.send(
					`Your work on "${task.description}" needs revision. Feedback from team lead:\n\n${feedback}\n\nPlease address this feedback and report your updated results.`,
				);
				task.result = retry;
				task.status = 'done'; // Accept after one retry
				log.info({ taskId: task.id }, 'Task completed after revision');
			} else {
				task.status = 'done';
			}
		} catch (err) {
			log.error({ err, taskId: task.id }, 'Task execution failed');
			task.status = 'failed';
			task.result = `Error: ${err instanceof Error ? err.message : String(err)}`;
		}
	}

	// Move to reviewing phase
	await transitionInstance(instance.id, 'reviewing');

	// Team lead does final review
	const taskSummary = instance.tasks
		.map((t) => `- [${t.status}] ${t.description} (${t.assignedTo})`)
		.join('\n');

	const finalReview = await teamLead.send(
		`All tasks have been executed. Here's the summary:\n\n${taskSummary}\n\nProvide a final assessment. Should we proceed to create a PR, or are there critical issues? Reply with:\n- "READY_FOR_PR: <PR title>" if ready\n- "NEEDS_WORK: <what's missing>" if not ready`,
	);

	if (finalReview.toUpperCase().includes('READY_FOR_PR:')) {
		instance.meetingLog.push(`[team-lead] Final review: ${finalReview}`);
	} else {
		// Mark complete anyway — we don't loop indefinitely
		instance.meetingLog.push(`[team-lead] Final review (issues noted): ${finalReview}`);
	}
}

function buildTaskPrompt(task: InstanceTask, workingDir: string, instance: Instance): string {
	const parts = ['You have been assigned the following task:', `\nTask: ${task.description}`];

	if (workingDir) {
		parts.push(`\nWorking directory: ${workingDir}`);
	}

	if (instance.issueRef) {
		parts.push(`\nRelated issue: ${instance.issueRef}`);
	}

	parts.push(
		'\nComplete the task to the best of your ability. Use your available tools to read, edit, and test code as needed. Report back with a summary of what you did.',
	);

	return parts.join('');
}
