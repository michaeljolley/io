import type { Squad } from '@io/shared';
import { createChildLogger } from '../../logging/logger.js';
import { type SquadRuntime, bootSquad, getSquadRuntime } from '../manager.js';
import {
	type Instance,
	type PrResult,
	cleanupInstance,
	createInstance,
	createPullRequest,
	executeTasks,
	runMeeting,
} from './index.js';

const logger = () => createChildLogger('runner');

export interface RunResult {
	instanceId: string;
	success: boolean;
	pr?: PrResult | null;
	error?: string;
}

/**
 * Run a full instance lifecycle:
 * 1. Create instance (with worktree)
 * 2. Hold round-table meeting
 * 3. Execute tasks
 * 4. Create PR
 * 5. Clean up
 */
export async function runInstance(params: {
	squad: Squad;
	objective: string;
	issueRef?: string;
}): Promise<RunResult> {
	const log = logger();
	const { squad, objective, issueRef } = params;

	// Ensure squad is booted
	let runtime: SquadRuntime | undefined = getSquadRuntime(squad.id);
	if (!runtime) {
		runtime = await bootSquad(squad);
	}

	// 1. Create instance
	const instance = await createInstance({ squad, issueRef, objective });
	log.info({ instanceId: instance.id }, 'Starting instance run');

	try {
		// 2. Run meeting
		const meetingResult = await runMeeting({ instance, runtime, objective });

		if (!meetingResult.consensus) {
			log.warn({ instanceId: instance.id }, 'Meeting did not reach consensus');
			return {
				instanceId: instance.id,
				success: false,
				error: `Meeting failed to reach consensus${meetingResult.vetoReason ? `: ${meetingResult.vetoReason}` : ''}`,
			};
		}

		if (instance.tasks.length === 0) {
			log.warn({ instanceId: instance.id }, 'No tasks generated from meeting');
			return {
				instanceId: instance.id,
				success: false,
				error: 'Meeting produced no actionable tasks',
			};
		}

		// 3. Execute tasks
		await executeTasks({ instance, runtime });

		// 4. Create PR
		const prTitle = objective.slice(0, 72);
		const pr = await createPullRequest({ instance, title: prTitle, squadName: squad.name });

		// 5. Cleanup (if no PR was created — otherwise keep the branch for review)
		if (!pr) {
			await cleanupInstance(instance.id, squad);
		}

		return {
			instanceId: instance.id,
			success: true,
			pr,
		};
	} catch (err) {
		log.error({ err, instanceId: instance.id }, 'Instance run failed');
		await cleanupInstance(instance.id, squad);
		return {
			instanceId: instance.id,
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
