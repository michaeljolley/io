import type { DatabaseClient } from "../src/store/db.js";
import {
	addMember,
	appendMessage,
	createConversation,
	createInboxItem,
	createObjective,
	createSchedule,
	createSquad,
	createTask,
	deleteConversation,
	deleteSchedule,
	deleteSquad,
	getConversation,
	getConversationMessageCount,
	getDueSchedules,
	getInboxItem,
	getMembers,
	getPendingBlockingQuestions,
	getRecentActivity,
	getSchedule,
	getSquad,
	getSquadActivity,
	getSquadByRepo,
	getTasksForObjective,
	getUsageByAgent,
	getUsageBySquad,
	getUsageSummary,
	incrementRevisionCount,
	listConversations,
	listInboxItems,
	listSchedules,
	logActivity,
	markRead,
	markScheduleRun,
	recordUsage,
	removeMember,
	replyToItem,
	resolveItem,
	updateMember,
	updateObjectiveStatus,
	updateSchedule,
	updateSquad,
	updateTaskStatus,
} from "../src/store/index.js";
import { cleanupStoreTestContext, createStoreTestContext, pause } from "./helpers.js";

describe("daemon store", () => {
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

	async function createSquadFixture(overrides: Partial<Parameters<typeof createSquad>[0]> = {}) {
		return createSquad(
			{
				name: "Alpha Squad",
				repoUrl: "https://github.com/octo/alpha",
				repoOwner: "octo",
				repoName: "alpha",
				status: "active",
				config: {
					prMode: "draft-pr",
					mcpServers: ["filesystem"],
					maxRevisions: 3,
				},
				...overrides,
			},
			db,
		);
	}

	it("creates squads and manages members", async () => {
		const squad = await createSquadFixture();
		const member = await addMember(
			squad.id,
			{
				role: "team-lead",
				name: "Taylor",
				systemPrompt: "Lead the squad",
				model: "claude-sonnet-4.6",
			},
			db,
		);

		const loaded = await getSquad(squad.id, db);
		const byRepo = await getSquadByRepo("octo", "alpha", db);

		expect(loaded).not.toBeNull();
		expect(loaded?.name).toBe("Alpha Squad");
		expect(loaded?.members).toHaveLength(1);
		expect(loaded?.members[0]).toMatchObject({ id: member.id, role: "team-lead" });
		expect(byRepo?.id).toBe(squad.id);
		expect(await removeMember(member.id, db)).toBe(true);
		expect(await getMembers(squad.id, db)).toHaveLength(0);
	});

	it("updates and deletes squads", async () => {
		const squad = await createSquadFixture();

		const updated = await updateSquad(
			squad.id,
			{
				name: "Bravo Squad",
				status: "inactive",
				config: {
					prMode: "ready-pr",
					mcpServers: ["filesystem", "github"],
					maxRevisions: 5,
				},
			},
			db,
		);

		expect(updated).toMatchObject({
			name: "Bravo Squad",
			status: "inactive",
			config: { prMode: "ready-pr", mcpServers: ["filesystem", "github"], maxRevisions: 5 },
		});
		expect(await deleteSquad(squad.id, db)).toBe(true);
		expect(await getSquad(squad.id, db)).toBeNull();
	});

	it("creates conversations, appends messages, lists them, and counts messages", async () => {
		const firstConversation = await createConversation("web", "Daily sync", db);
		await appendMessage(firstConversation.id, "user", "Hello team", null, undefined, db);
		await appendMessage(
			firstConversation.id,
			"assistant",
			"Status is green",
			"gpt-4.1-mini",
			{ inputTokens: 12, outputTokens: 18 },
			db,
		);
		await pause();
		const secondConversation = await createConversation("scheduler", "Nightly job", db);

		const loaded = await getConversation(firstConversation.id, db);
		const conversations = await listConversations(10, 0, db);

		expect(loaded?.messages).toHaveLength(2);
		expect(loaded?.messages[1]).toMatchObject({
			role: "assistant",
			content: "Status is green",
			inputTokens: 12,
			outputTokens: 18,
		});
		expect(await getConversationMessageCount(firstConversation.id, db)).toBe(2);
		expect(conversations.map((conversation) => conversation.id)).toEqual([
			secondConversation.id,
			firstConversation.id,
		]);
		expect(await deleteConversation(firstConversation.id, db)).toBe(true);
		expect(await getConversation(firstConversation.id, db)).toBeNull();
	});

	it("stores inbox items, replies, marks read, resolves, and filters by status", async () => {
		const squad = await createSquadFixture();
		const deliverable = await createInboxItem(
			{
				squadId: squad.id,
				type: "deliverable",
				title: "PR ready",
				content: "A draft PR is ready for review.",
			},
			db,
		);
		const blockingQuestion = await createInboxItem(
			{
				squadId: squad.id,
				type: "blocking_question",
				title: "Need API key",
				content: "Can we get staging credentials?",
			},
			db,
		);

		const readItem = await markRead(deliverable.id, db);
		const pendingQuestions = await getPendingBlockingQuestions(squad.id, db);
		const replied = await replyToItem(blockingQuestion.id, "Use the shared staging key.", db);
		const resolved = await resolveItem(deliverable.id, db);

		expect(readItem?.status).toBe("read");
		expect(pendingQuestions.map((item) => item.id)).toEqual([blockingQuestion.id]);
		expect(replied).toMatchObject({ status: "replied", reply: "Use the shared staging key." });
		expect(resolved?.status).toBe("resolved");
		expect((await listInboxItems("pending", 10, 0, db)).length).toBe(0);
		expect((await listInboxItems("replied", 10, 0, db)).map((item) => item.id)).toEqual([
			blockingQuestion.id,
		]);
	});

	it("returns null for missing inbox items", async () => {
		expect(await getInboxItem("missing", db)).toBeNull();
		expect(await markRead("missing", db)).toBeNull();
		expect(await replyToItem("missing", "No-op", db)).toBeNull();
	});

	it("creates, updates, lists, deletes, and finds due schedules", async () => {
		const schedule = await createSchedule(
			{
				name: "Nightly triage",
				cronExpression: "* * * * *",
				prompt: "Review inbox items",
			},
			db,
		);
		const disabled = await createSchedule(
			{
				name: "Paused sync",
				cronExpression: "0 * * * *",
				prompt: "Sync docs",
				enabled: false,
			},
			db,
		);

		const updated = await updateSchedule(
			schedule.id,
			{ name: "Hourly triage", prompt: "Check pending work", cronExpression: "*/5 * * * *" },
			db,
		);
		const loaded = await getSchedule(schedule.id, db);
		const due = await getDueSchedules(updated?.nextRunAt ?? new Date().toISOString(), db);
		const marked = await markScheduleRun(
			schedule.id,
			updated?.nextRunAt ?? new Date().toISOString(),
			db,
		);

		expect(disabled.nextRunAt).toBeNull();
		expect(updated).toMatchObject({ name: "Hourly triage", prompt: "Check pending work" });
		expect(loaded?.cronExpression).toBe("*/5 * * * *");
		expect(due.map((item) => item.id)).toContain(schedule.id);
		expect(marked?.lastRunAt).toBe(updated?.nextRunAt ?? null);
		expect(marked?.nextRunAt).not.toBeNull();
		expect((await listSchedules(db)).length).toBe(2);
		expect(await deleteSchedule(disabled.id, db)).toBe(true);
	});

	it("records token usage and summarizes by time range, squad, and agent", async () => {
		const squad = await createSquadFixture();
		const member = await addMember(
			squad.id,
			{
				role: "backend-engineer",
				name: "Casey",
				systemPrompt: "Build backend features",
				model: "claude-sonnet-4.6",
			},
			db,
		);
		await recordUsage(
			{
				squadId: squad.id,
				agentId: member.id,
				model: "gpt-4.1-mini",
				inputTokens: 100,
				outputTokens: 40,
				cost: 1.25,
				createdAt: "2025-01-01T10:00:00.000Z",
			},
			db,
		);
		await recordUsage(
			{
				squadId: squad.id,
				agentId: member.id,
				model: "claude-sonnet-4.6",
				inputTokens: 50,
				outputTokens: 10,
				cost: 2.75,
				createdAt: "2025-01-02T10:00:00.000Z",
			},
			db,
		);
		await recordUsage(
			{
				model: "gpt-4.1-mini",
				inputTokens: 500,
				outputTokens: 200,
				cost: 9.99,
				createdAt: "2024-12-20T10:00:00.000Z",
			},
			db,
		);

		const summary = await getUsageSummary(
			{ startDate: "2025-01-01T00:00:00.000Z", endDate: "2025-01-31T23:59:59.999Z" },
			db,
		);
		const bySquad = await getUsageBySquad(
			squad.id,
			"2025-01-01T00:00:00.000Z",
			"2025-01-31T23:59:59.999Z",
			db,
		);
		const byAgent = await getUsageByAgent(
			member.id,
			"2025-01-01T00:00:00.000Z",
			"2025-01-31T23:59:59.999Z",
			db,
		);

		expect(summary.totalInputTokens).toBe(150);
		expect(summary.totalOutputTokens).toBe(50);
		expect(summary.totalCost).toBeCloseTo(4, 6);
		expect(summary.bySquad[0]).toMatchObject({
			squadId: squad.id,
			squadName: "Alpha Squad",
			cost: 4,
		});
		expect(summary.byAgent[0]).toMatchObject({
			agentId: member.id,
			agentName: "Casey",
			squadId: squad.id,
		});
		expect(summary.byModel.map((item) => item.model)).toEqual([
			"claude-sonnet-4.6",
			"gpt-4.1-mini",
		]);
		expect(summary.daily.map((point) => point.date)).toEqual(["2025-01-01", "2025-01-02"]);
		expect(bySquad.totalCost).toBeCloseTo(4, 6);
		expect(byAgent.totalInputTokens).toBe(150);
	});

	it("logs activity and fetches recent items and squad activity", async () => {
		const squad = await createSquadFixture();
		const older = await logActivity(
			{
				squadId: squad.id,
				event: "objective.created",
				description: "Created objective",
				metadata: { priority: "high" },
				createdAt: "2025-01-01T08:00:00.000Z",
			},
			db,
		);
		const newer = await logActivity(
			{
				squadId: squad.id,
				event: "task.completed",
				description: "Finished implementation",
				createdAt: "2025-01-02T08:00:00.000Z",
			},
			db,
		);

		const recent = await getRecentActivity(10, 0, db);
		const squadActivity = await getSquadActivity(squad.id, 10, 0, db);

		expect(recent.map((item) => item.id)).toEqual([newer.id, older.id]);
		expect(squadActivity).toHaveLength(2);
		expect(squadActivity[1].metadata).toEqual({ priority: "high" });
	});

	it("creates objectives, updates status, increments revisions, and manages tasks", async () => {
		const squad = await createSquadFixture();
		const objective = await createObjective(squad.id, "Ship usage dashboard", db);
		const planning = await updateObjectiveStatus(objective.id, "planning", db);
		await incrementRevisionCount(objective.id, db);
		const revised = await incrementRevisionCount(objective.id, db);
		const task = await createTask(
			objective.id,
			{
				title: "Implement queries",
				description: "Add usage aggregations",
				status: "pending",
			},
			db,
		);
		const completedTask = await updateTaskStatus(task.id, "done", "Added summary queries", db);
		const tasks = await getTasksForObjective(objective.id, db);

		expect(planning?.status).toBe("planning");
		expect(revised?.revisionCount).toBe(2);
		expect(tasks).toHaveLength(1);
		expect(completedTask).toMatchObject({ status: "done", result: "Added summary queries" });
		expect(await updateObjectiveStatus("missing", "completed", db)).toBeNull();
	});

	it("updates squad member role, systemPrompt, and model", async () => {
		const squad = await createSquadFixture();
		const member = await addMember(
			squad.id,
			{
				role: "team-lead",
				name: "Taylor",
				systemPrompt: "Lead the squad",
				model: "claude-sonnet-4.6",
			},
			db,
		);

		const updatedRole = await updateMember(member.id, { role: "qa" }, db);
		expect(updatedRole?.role).toBe("qa");
		expect(updatedRole?.systemPrompt).toBe("Lead the squad");

		const updatedPrompt = await updateMember(
			member.id,
			{ systemPrompt: "Review all code carefully" },
			db,
		);
		expect(updatedPrompt?.role).toBe("qa");
		expect(updatedPrompt?.systemPrompt).toBe("Review all code carefully");

		const updatedModel = await updateMember(member.id, { model: "gpt-4.1" }, db);
		expect(updatedModel?.model).toBe("gpt-4.1");

		const updatedAll = await updateMember(
			member.id,
			{ role: "frontend-engineer", systemPrompt: "Build UI", model: "" },
			db,
		);
		expect(updatedAll?.role).toBe("frontend-engineer");
		expect(updatedAll?.systemPrompt).toBe("Build UI");
		expect(updatedAll?.model).toBeNull();

		const noOp = await updateMember(member.id, {}, db);
		expect(noOp?.role).toBe("frontend-engineer");
	});
});
