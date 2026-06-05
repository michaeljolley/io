import { exec } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { EVENT_NAMES } from "@io/shared";
import type { Objective, SquadMember, Task } from "@io/shared";

import { eventBus } from "../event-bus.js";
import { isSquadAvailable } from "../squad/manager.js";
import {
	createTask,
	getObjective,
	getSquad,
	getTasksForObjective,
	updateObjectiveBranch,
	updateObjectivePlan,
	updateObjectivePrUrl,
	updateObjectiveStatus,
	updateSquad,
	updateTaskStatus,
} from "../store/index.js";
import { executeAgentTask } from "./agent.js";
import { extractLearnings } from "./history.js";
import { createPlan } from "./planning.js";
import { buildPrBody, createPullRequest } from "./pr.js";
import { getGitDiff, handleQARejection, runQAReview } from "./qa.js";
import { conductReview } from "./review.js";
import {
	createTasksFromPlan,
	getNextPendingTasks,
	markTaskComplete,
	markTaskFailed,
} from "./tasks.js";
import { cleanupWorktree, createWorktree } from "./worktree.js";

const execAsync = promisify(exec);

export interface ExecuteObjectiveResult {
	success: boolean;
	prUrl?: string;
	error?: string;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function runGit(command: string, cwd: string): Promise<string> {
	const { stdout } = await execAsync(command, {
		cwd,
		maxBuffer: 5 * 1024 * 1024,
	});
	return stdout.trim();
}

async function resolveRepoPath(repoUrl: string, repoName: string): Promise<string> {
	const candidates = [
		process.cwd(),
		join(process.cwd(), repoName),
		join(process.cwd(), "repos", repoName),
		join(process.cwd(), "..", repoName),
	];

	for (const candidate of candidates) {
		if (!(await pathExists(join(candidate, ".git")))) {
			continue;
		}

		const remoteUrl = await runGit("git remote get-url origin", candidate).catch(() => "");
		if (
			!remoteUrl ||
			remoteUrl.includes(repoUrl) ||
			remoteUrl.includes(repoName) ||
			basename(candidate) === repoName
		) {
			return candidate;
		}
	}

	throw new Error(`Unable to resolve a local repository path for ${repoUrl}`);
}

function findMemberByRole(members: SquadMember[], role: string): SquadMember | undefined {
	const normalized = role.trim().toLowerCase();
	return members.find((member) => member.role.trim().toLowerCase() === normalized);
}

function requireMemberByRole(members: SquadMember[], role: string): SquadMember {
	const member = findMemberByRole(members, role);
	if (!member) {
		throw new Error(`Squad is missing required role: ${role}`);
	}
	return member;
}

function buildBranchName(objectiveId: string): string {
	return `io/${objectiveId.slice(0, 8)}`;
}

function summarizeTask(task: Task, member?: SquadMember): string {
	const owner = member ? `${member.name} (${member.role})` : (task.assigneeId ?? "unassigned");
	return `${task.title} — ${owner}: ${task.result ?? "No result recorded."}`;
}

async function executePendingTasks(
	objective: Objective,
	members: SquadMember[],
	worktreePath: string,
	mcpServers: string[],
): Promise<Task[]> {
	const pendingTasks = await getNextPendingTasks(objective.id);
	if (pendingTasks.length === 0) {
		return getTasksForObjective(objective.id);
	}

	const results = await Promise.allSettled(
		pendingTasks.map(async (task) => {
			const member = members.find((candidate) => candidate.id === task.assigneeId);
			if (!member) {
				const failedTask = await markTaskFailed(
					task.id,
					"No squad member matched the task assignee.",
				);
				eventBus.emit(EVENT_NAMES.TASK_FAILED, {
					task: failedTask,
					agentName: "unassigned",
					reason: failedTask.result ?? "No assignee",
				});
				throw new Error(`Task ${task.id} has no matching assignee`);
			}

			const inProgressTask = await updateTaskStatus(
				task.id,
				"in_progress",
				task.result ?? undefined,
			);
			const startedTask = inProgressTask ?? task;
			eventBus.emit(EVENT_NAMES.TASK_STARTED, { task: startedTask, agentName: member.name });
			eventBus.emit(EVENT_NAMES.AGENT_EXECUTING, {
				squadId: objective.squadId,
				agentId: member.id,
				taskId: task.id,
			});

			const execution = await executeAgentTask(member, task, worktreePath, { mcpServers });
			if (!execution.success) {
				const failedTask = await markTaskFailed(task.id, execution.result);
				eventBus.emit(EVENT_NAMES.TASK_FAILED, {
					task: failedTask,
					agentName: member.name,
					reason: execution.result,
				});
				throw new Error(execution.result);
			}

			const completedTask = await markTaskComplete(task.id, execution.result);
			await extractLearnings(member.id, member.squadId, execution.result);
			eventBus.emit(EVENT_NAMES.TASK_COMPLETED, { task: completedTask, agentName: member.name });
			eventBus.emit(EVENT_NAMES.AGENT_COMPLETED, {
				squadId: objective.squadId,
				agentId: member.id,
				taskId: task.id,
			});
			return completedTask;
		}),
	);

	const failed = results.find((result) => result.status === "rejected");
	if (failed && failed.status === "rejected") {
		throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
	}

	return getTasksForObjective(objective.id);
}

async function createFeedbackTask(
	objectiveId: string,
	teamLead: SquadMember,
	title: string,
	description: string,
): Promise<void> {
	await createTask(objectiveId, {
		assigneeId: teamLead.id,
		title,
		description,
		status: "pending",
	});
}

export async function executeObjective(
	squadId: string,
	objectiveId: string,
): Promise<ExecuteObjectiveResult> {
	const squadRecord = await getSquad(squadId);
	if (!squadRecord) {
		return { success: false, error: `Squad ${squadId} was not found.` };
	}

	const objectiveRecord = await getObjective(objectiveId);
	if (!objectiveRecord || objectiveRecord.squadId !== squadId) {
		return {
			success: false,
			error: `Objective ${objectiveId} was not found for squad ${squadId}.`,
		};
	}

	if (!(await isSquadAvailable(squadId))) {
		return { success: false, error: `Squad ${squadId} is not available for execution.` };
	}

	const teamLead = requireMemberByRole(squadRecord.members, "team-lead");
	const qaMember = requireMemberByRole(squadRecord.members, "qa");
	const repoPath = await resolveRepoPath(squadRecord.repoUrl, squadRecord.repoName);
	const baseBranch = (await runGit("git branch --show-current", repoPath)) || "main";
	const branchName = buildBranchName(objectiveId);
	let worktreePath: string | null = null;
	let currentObjective: Objective = objectiveRecord;

	try {
		await updateSquad(squadId, { status: "executing" });
		const startedObjective = await updateObjectiveStatus(objectiveId, "planning");
		if (startedObjective) {
			currentObjective = startedObjective;
		}
		eventBus.emit(EVENT_NAMES.OBJECTIVE_STARTED, { objective: currentObjective });

		worktreePath = await createWorktree(repoPath, branchName, baseBranch);
		const objectiveWithBranch = await updateObjectiveBranch(objectiveId, branchName);
		if (objectiveWithBranch) {
			currentObjective = objectiveWithBranch;
		}

		const planned = await createPlan(currentObjective, squadRecord.members, worktreePath);
		const objectiveWithPlan = await updateObjectivePlan(objectiveId, planned.plan);
		if (objectiveWithPlan) {
			currentObjective = objectiveWithPlan;
		}
		await updateObjectiveStatus(objectiveId, "executing");
		await createTasksFromPlan(objectiveId, planned.tasks, squadRecord.members);

		let qaOutcome: { approved: boolean; feedback: string } | null = null;
		while (true) {
			currentObjective = (await getObjective(objectiveId)) ?? currentObjective;
			await executePendingTasks(
				currentObjective,
				squadRecord.members,
				worktreePath,
				squadRecord.config.mcpServers,
			);
			const tasksAfterExecution = await getTasksForObjective(objectiveId);

			eventBus.emit(EVENT_NAMES.REVIEW_STARTED, { objectiveId });
			const reviewOutcome = await conductReview(
				currentObjective,
				tasksAfterExecution,
				squadRecord.members,
			);
			eventBus.emit(EVENT_NAMES.REVIEW_COMPLETED, {
				objectiveId,
				summary: reviewOutcome.summary,
			});
			if (!reviewOutcome.approved) {
				await createFeedbackTask(
					objectiveId,
					teamLead,
					"Address review feedback",
					`${reviewOutcome.summary}\n\n${reviewOutcome.issues?.join("\n") ?? "Resolve the review feedback and re-validate the work."}`,
				);
				continue;
			}

			const qaStatus = await updateObjectiveStatus(objectiveId, "qa");
			if (qaStatus) {
				currentObjective = qaStatus;
			}
			const diff = await getGitDiff(worktreePath);
			qaOutcome = await runQAReview(currentObjective, qaMember, worktreePath, diff);
			if (qaOutcome.approved) {
				eventBus.emit(EVENT_NAMES.QA_APPROVED, { objectiveId });
				break;
			}

			const rejection = await handleQARejection(objectiveId, qaOutcome.feedback);
			if (rejection.escalated) {
				return { success: false, error: rejection.feedback };
			}

			await updateObjectiveStatus(objectiveId, "executing");
			await createFeedbackTask(
				objectiveId,
				teamLead,
				`Address QA feedback (revision ${rejection.revisionCount})`,
				rejection.feedback,
			);
		}

		const finalTasks = await getTasksForObjective(objectiveId);
		const taskSummaries = finalTasks.map((task) =>
			summarizeTask(
				task,
				squadRecord.members.find((member) => member.id === task.assigneeId),
			),
		);
		const prBody = buildPrBody(
			currentObjective,
			currentObjective.plan ?? planned.plan,
			taskSummaries,
			qaOutcome ?? {
				approved: true,
				feedback: "QA approved the work.",
			},
		);
		const prResult = await createPullRequest({
			repoPath: worktreePath,
			branchName,
			baseBranch,
			title: currentObjective.description,
			body: prBody,
			prMode: squadRecord.config.prMode,
		});
		if (prResult.prUrl) {
			const updatedObjective = await updateObjectivePrUrl(objectiveId, prResult.prUrl);
			if (updatedObjective) {
				currentObjective = updatedObjective;
			}
			eventBus.emit(EVENT_NAMES.PR_CREATED, { objectiveId, prUrl: prResult.prUrl });
			if (prResult.merged) {
				eventBus.emit(EVENT_NAMES.PR_MERGED, { objectiveId, prUrl: prResult.prUrl });
			}
		}

		const completedObjective = await updateObjectiveStatus(objectiveId, "completed");
		if (completedObjective) {
			currentObjective = completedObjective;
		}
		eventBus.emit(EVENT_NAMES.OBJECTIVE_COMPLETED, { objective: currentObjective });
		return { success: true, prUrl: prResult.prUrl };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const failedObjective = await updateObjectiveStatus(objectiveId, "failed");
		if (failedObjective) {
			currentObjective = failedObjective;
		}
		eventBus.emit(EVENT_NAMES.OBJECTIVE_FAILED, {
			objective: currentObjective,
			reason: message,
		});
		return { success: false, error: message };
	} finally {
		if (worktreePath) {
			await cleanupWorktree(worktreePath).catch(() => undefined);
		}
		await updateSquad(squadId, { status: "active" }).catch(() => null);
	}
}
