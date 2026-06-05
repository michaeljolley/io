import type { SquadMember, Task } from "@io/shared";

import { createTask, getTasksForObjective, updateTaskStatus } from "../store/index.js";

export interface PlannedTask {
	title: string;
	description: string;
	assigneeRole: string;
}

function normalizeRole(role: string): string {
	return role.trim().toLowerCase();
}

function findAssigneeId(role: string, members: SquadMember[]): string | null {
	const normalized = normalizeRole(role);
	const directMatch = members.find((member) => normalizeRole(member.role) === normalized);
	if (directMatch) {
		return directMatch.id;
	}

	const slugMatch = members.find((member) => {
		const memberRole = normalizeRole(member.role);
		return memberRole.includes(normalized) || normalized.includes(memberRole);
	});
	if (slugMatch) {
		return slugMatch.id;
	}

	return members.find((member) => normalizeRole(member.role) === "team-lead")?.id ?? null;
}

export async function createTasksFromPlan(
	objectiveId: string,
	planned: PlannedTask[],
	members: SquadMember[],
): Promise<Task[]> {
	const createdTasks: Task[] = [];

	for (const item of planned) {
		const task = await createTask(objectiveId, {
			title: item.title,
			description: item.description,
			assigneeId: findAssigneeId(item.assigneeRole, members),
			status: "pending",
		});
		createdTasks.push(task);
	}

	return createdTasks;
}

export async function getNextPendingTasks(objectiveId: string): Promise<Task[]> {
	const tasks = await getTasksForObjective(objectiveId);
	return tasks.filter((task) => task.status === "pending");
}

export async function markTaskComplete(taskId: string, result: string): Promise<Task> {
	const task = await updateTaskStatus(taskId, "done", result);
	if (!task) {
		throw new Error(`Unable to mark task ${taskId} complete`);
	}

	return task;
}

export async function markTaskFailed(taskId: string, reason: string): Promise<Task> {
	const task = await updateTaskStatus(taskId, "failed", reason);
	if (!task) {
		throw new Error(`Unable to mark task ${taskId} failed`);
	}

	return task;
}

export async function areAllTasksComplete(objectiveId: string): Promise<boolean> {
	const tasks = await getTasksForObjective(objectiveId);
	return tasks.length > 0 && tasks.every((task) => task.status === "done");
}
