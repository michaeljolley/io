import type { EventEmitter } from "node:events";
import { SCHEDULER_INTERVAL_MS, type Schedule } from "@io/shared";
import { CronExpressionParser } from "cron-parser";

import { createLogger } from "../logging/logger.js";
import type { Orchestrator } from "../orchestrator/orchestrator.js";
import { getDatabase } from "../store/db.js";
import { listSchedules, markScheduleRun } from "../store/index.js";

export class Scheduler {
	private readonly orchestrator: Orchestrator;
	private readonly eventBus: EventEmitter;
	private readonly logger = createLogger("scheduler");
	private timer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(orchestrator: Orchestrator, eventBus: EventEmitter) {
		this.orchestrator = orchestrator;
		this.eventBus = eventBus;
	}

	start(): void {
		if (this.timer) {
			return;
		}
		this.timer = setInterval(() => {
			void this.tick().catch((error: unknown) => {
				this.logger.error({ err: error }, "Scheduler tick failed");
			});
		}, SCHEDULER_INTERVAL_MS);
		void this.tick().catch((error: unknown) => {
			this.logger.error({ err: error }, "Initial scheduler tick failed");
		});
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async tick(): Promise<void> {
		if (this.running) {
			return;
		}
		this.running = true;
		try {
			const now = new Date();
			const schedules = await this.getDueSchedules(now);
			for (const schedule of schedules) {
				try {
					await this.orchestrator.processMessage(schedule.prompt, undefined, "scheduler");
					await markScheduleRun(schedule.id, now);
				} catch (error) {
					this.logger.error(
						{ err: error, scheduleId: schedule.id },
						"Scheduled prompt execution failed",
					);
				}
			}
		} finally {
			this.running = false;
		}
	}

	private async getDueSchedules(now: Date): Promise<Schedule[]> {
		const database = await getDatabase();
		const allSchedules = await listSchedules(database);
		const nowIso = now.toISOString();
		return allSchedules.filter((schedule) => this.isScheduleDue(schedule, nowIso));
	}

	private isScheduleDue(schedule: Schedule, nowIso: string): boolean {
		if (!schedule.enabled) {
			return false;
		}
		if (schedule.lastRunAt === null) {
			return schedule.createdAt <= nowIso;
		}
		if (schedule.nextRunAt && schedule.nextRunAt <= nowIso) {
			return true;
		}
		try {
			const interval = CronExpressionParser.parse(schedule.cronExpression, {
				currentDate: schedule.lastRunAt,
			});
			const nextRun = interval.next().toISOString() ?? "";
			return nextRun.length > 0 && nextRun <= nowIso;
		} catch (error) {
			this.logger.warn(
				{ err: error, scheduleId: schedule.id },
				"Invalid cron while evaluating schedule",
			);
			return false;
		}
	}
}

export function createScheduler(orchestrator: Orchestrator, eventBus: EventEmitter): Scheduler {
	return new Scheduler(orchestrator, eventBus);
}
