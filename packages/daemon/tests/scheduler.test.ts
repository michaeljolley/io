import { CronExpressionParser } from "cron-parser";

import type { DatabaseClient } from "../src/store/db.js";
import {
	createSchedule,
	getDueSchedules,
	getSchedule,
	markScheduleRun,
	updateSchedule,
} from "../src/store/index.js";
import { cleanupStoreTestContext, createStoreTestContext } from "./helpers.js";

async function runDueSchedules(
	now: string,
	db: DatabaseClient,
	sendPrompt: (prompt: string, scheduleId: string) => Promise<void>,
): Promise<string[]> {
	const due = await getDueSchedules(now, db);

	for (const schedule of due) {
		await sendPrompt(schedule.prompt, schedule.id);
		await markScheduleRun(schedule.id, now, db);
	}

	return due.map((schedule) => schedule.id);
}

describe("scheduler concepts", () => {
	let context: Awaited<ReturnType<typeof createStoreTestContext>> | null = null;
	let db: DatabaseClient;

	beforeEach(async () => {
		context = await createStoreTestContext();
		db = context.db;
	});

	afterEach(async () => {
		await cleanupStoreTestContext(context);
		context = null;
	});

	it.each([
		["* * * * *", "2025-01-01T00:01:00.000Z"],
		["0 */6 * * *", "2025-01-01T06:00:00.000Z"],
		["15 9 * * 1-5", "2025-01-01T09:15:00.000Z"],
	])("parses valid cron expression %s", (expression, expectedNext) => {
		const interval = CronExpressionParser.parse(expression, {
			currentDate: "2025-01-01T00:00:00.000Z",
			tz: "UTC",
		});

		expect(interval.next().toISOString()).toBe(expectedNext);
	});

	it("creates enabled schedules with a next run time", async () => {
		const schedule = await createSchedule(
			{
				name: "Minute sync",
				cronExpression: "* * * * *",
				prompt: "Sync inbox",
			},
			db,
		);

		expect(schedule.enabled).toBe(true);
		expect(schedule.nextRunAt).not.toBeNull();
	});

	it("keeps disabled schedules out of due checks until re-enabled", async () => {
		const schedule = await createSchedule(
			{
				name: "Paused job",
				cronExpression: "* * * * *",
				prompt: "Do nothing",
				enabled: false,
			},
			db,
		);

		expect(schedule.nextRunAt).toBeNull();
		expect(await getDueSchedules("2099-01-01T00:00:00.000Z", db)).toEqual([]);

		const updated = await updateSchedule(schedule.id, { enabled: true }, db);
		expect(updated?.nextRunAt).not.toBeNull();
	});

	it("detects due schedules based on next run time", async () => {
		const schedule = await createSchedule(
			{
				name: "Triage",
				cronExpression: "* * * * *",
				prompt: "Review messages",
			},
			db,
		);

		const beforeDue = await getDueSchedules("2000-01-01T00:00:00.000Z", db);
		const whenDue = await getDueSchedules(schedule.nextRunAt ?? "", db);

		expect(beforeDue).toEqual([]);
		expect(whenDue.map((item) => item.id)).toEqual([schedule.id]);
	});

	it("sends scheduled prompts through an orchestrator and marks schedules as run", async () => {
		const first = await createSchedule(
			{
				name: "Morning brief",
				cronExpression: "* * * * *",
				prompt: "Summarize overnight issues",
			},
			db,
		);
		const second = await createSchedule(
			{
				name: "Backlog review",
				cronExpression: "* * * * *",
				prompt: "Review backlog health",
			},
			db,
		);
		const sentPrompts: Array<{ prompt: string; scheduleId: string }> = [];
		const now =
			[first.nextRunAt, second.nextRunAt].filter(Boolean).sort()[1] ?? new Date().toISOString();

		const dueIds = await runDueSchedules(now, db, async (prompt, scheduleId) => {
			sentPrompts.push({ prompt, scheduleId });
		});
		const rerunDue = await getDueSchedules(now, db);
		const refreshed = await Promise.all([getSchedule(first.id, db), getSchedule(second.id, db)]);

		expect([...dueIds].sort()).toEqual([first.id, second.id].sort());
		expect(
			[...sentPrompts].sort((left, right) => left.scheduleId.localeCompare(right.scheduleId)),
		).toEqual(
			[
				{ prompt: "Summarize overnight issues", scheduleId: first.id },
				{ prompt: "Review backlog health", scheduleId: second.id },
			].sort((left, right) => left.scheduleId.localeCompare(right.scheduleId)),
		);
		expect(rerunDue).toEqual([]);
		expect(refreshed[0]?.lastRunAt).toBe(now);
		expect(refreshed[1]?.lastRunAt).toBe(now);
	});

	it("rejects invalid cron expressions", async () => {
		await expect(
			createSchedule(
				{
					name: "Broken",
					cronExpression: "not a cron",
					prompt: "Should fail",
				},
				db,
			),
		).rejects.toThrow();
	});
});
