import { sendMessage } from '../copilot/orchestrator.js';
import { createChildLogger } from '../logging/logger.js';
import { getEventBus } from '../squad/event-bus.js';
import { runInstance } from '../squad/execution/runner.js';
import { getSquadByName, listSquads } from '../squad/manager.js';
import { addInboxEntry } from '../store/inbox.js';
import { type Schedule, getDueSchedules, markScheduleFired } from '../store/schedules.js';

const logger = () => createChildLogger('scheduler');

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

const TICK_INTERVAL_MS = 60_000; // Check every minute

/**
 * Start the schedule engine. Evaluates due schedules every 60 seconds.
 */
export function startScheduler(): void {
	const log = logger();
	log.info('Scheduler started');

	// Initial tick
	tick();

	intervalHandle = setInterval(() => {
		tick();
	}, TICK_INTERVAL_MS);
}

/**
 * Stop the schedule engine.
 */
export function stopScheduler(): void {
	if (intervalHandle) {
		clearInterval(intervalHandle);
		intervalHandle = null;
	}
}

async function tick(): Promise<void> {
	if (running) return; // Prevent overlapping ticks
	running = true;

	try {
		const due = await getDueSchedules();
		if (due.length === 0) {
			running = false;
			return;
		}

		const log = logger();
		log.info({ count: due.length }, 'Firing due schedules');

		for (const schedule of due) {
			await fireSchedule(schedule);
		}
	} catch (err) {
		logger().error({ err }, 'Scheduler tick error');
	} finally {
		running = false;
	}
}

async function fireSchedule(schedule: Schedule): Promise<void> {
	const log = logger();
	const bus = getEventBus();

	// Emit fired event
	bus.emit({
		type: 'schedule:fired',
		id: crypto.randomUUID(),
		timestamp: new Date(),
		data: { scheduleId: schedule.id, name: schedule.name },
	});

	log.info({ scheduleId: schedule.id, name: schedule.name }, 'Firing schedule');

	// Mark as fired immediately (update next_run)
	await markScheduleFired(schedule.id, schedule.cron);

	try {
		let result: string;

		if (schedule.targetType === 'orchestrator') {
			// Send as if user typed it
			result = await sendMessage(schedule.prompt, 'web', () => {});
		} else {
			// Squad target — run instance
			const squads = await listSquads();
			const squad = squads.find((s) => s.id === schedule.targetId || s.name === schedule.targetId);

			if (!squad) {
				throw new Error(`Target squad not found: ${schedule.targetId}`);
			}

			const runResult = await runInstance({
				squad,
				objective: schedule.prompt,
			});

			if (runResult.success) {
				result = runResult.pr
					? `Completed successfully. PR: ${runResult.pr.url}`
					: 'Completed successfully (no PR created).';
			} else {
				result = `Failed: ${runResult.error ?? 'unknown error'}`;
			}
		}

		// Post result to inbox as deliverable
		const squadId =
			schedule.targetType === 'squad' && schedule.targetId ? schedule.targetId : 'orchestrator';

		// Only post to inbox if we have a real squad target
		if (schedule.targetType === 'squad' && schedule.targetId) {
			await addInboxEntry({
				squadId: schedule.targetId,
				kind: 'deliverable',
				title: `Schedule: ${schedule.name}`,
				content: result,
			});
		}

		// Emit completed event
		bus.emit({
			type: 'schedule:completed',
			id: crypto.randomUUID(),
			timestamp: new Date(),
			data: { scheduleId: schedule.id, name: schedule.name, result: result.slice(0, 200) },
		});

		log.info({ scheduleId: schedule.id }, 'Schedule completed');
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		log.error({ err, scheduleId: schedule.id }, 'Schedule execution failed');

		// Emit failed event
		bus.emit({
			type: 'schedule:failed',
			id: crypto.randomUUID(),
			timestamp: new Date(),
			data: { scheduleId: schedule.id, name: schedule.name, error: errorMsg },
		});
	}
}
