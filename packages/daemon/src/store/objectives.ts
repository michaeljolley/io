import type { Objective, ObjectiveStatus, Task, TaskStatus } from "@io/shared";
import {
	type DatabaseClient,
	asNullableString,
	asNumber,
	asString,
	generateId,
	getDatabase,
	nowIso,
} from "./db.js";

export interface ObjectiveRecord extends Objective {
	tasks: Task[];
}

export interface CreateTaskInput {
	assigneeId?: string | null;
	title: string;
	description: string;
	status?: TaskStatus;
	result?: string | null;
}

export async function createObjective(
	squadId: string,
	description: string,
	db?: DatabaseClient,
): Promise<Objective> {
	const database = db ?? (await getDatabase());
	const timestamp = nowIso();
	const objective: Objective = {
		id: generateId(),
		squadId,
		description,
		status: "pending",
		plan: null,
		revisionCount: 0,
		branch: null,
		prUrl: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await database.execute({
		sql: `INSERT INTO objectives (id, squad_id, description, status, plan, revision_count, branch, pr_url, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			objective.id,
			objective.squadId,
			objective.description,
			objective.status,
			objective.plan,
			objective.revisionCount,
			objective.branch,
			objective.prUrl,
			objective.createdAt,
			objective.updatedAt,
		],
	});

	return objective;
}

export async function getObjective(
	id: string,
	db?: DatabaseClient,
): Promise<ObjectiveRecord | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM objectives WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];

	if (!row) {
		return null;
	}

	const objective = mapObjective(row);
	const tasks = await getTasksForObjective(id, database);
	return { ...objective, tasks };
}

export async function updateObjectiveStatus(
	id: string,
	status: ObjectiveStatus,
	db?: DatabaseClient,
): Promise<Objective | null> {
	return updateObjectiveFields(id, { status, updated_at: nowIso() }, db);
}

export async function updateObjectivePlan(
	id: string,
	plan: string,
	db?: DatabaseClient,
): Promise<Objective | null> {
	return updateObjectiveFields(id, { plan, updated_at: nowIso() }, db);
}

export async function updateObjectiveBranch(
	id: string,
	branch: string,
	db?: DatabaseClient,
): Promise<Objective | null> {
	return updateObjectiveFields(id, { branch, updated_at: nowIso() }, db);
}

export async function updateObjectivePrUrl(
	id: string,
	prUrl: string,
	db?: DatabaseClient,
): Promise<Objective | null> {
	return updateObjectiveFields(id, { pr_url: prUrl, updated_at: nowIso() }, db);
}

export async function incrementRevisionCount(
	id: string,
	db?: DatabaseClient,
): Promise<Objective | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "UPDATE objectives SET revision_count = revision_count + 1, updated_at = ? WHERE id = ?",
		args: [nowIso(), id],
	});

	if (result.rowsAffected === 0) {
		return null;
	}

	return getObjectiveRow(id, database);
}

export async function getActiveObjectives(
	squadId?: string,
	db?: DatabaseClient,
): Promise<Objective[]> {
	const database = db ?? (await getDatabase());
	const hasSquadFilter = typeof squadId === "string";
	const result = await database.execute({
		sql: `SELECT * FROM objectives
		      WHERE status NOT IN ('completed', 'failed', 'escalated')
		      ${hasSquadFilter ? "AND squad_id = ?" : ""}
		      ORDER BY updated_at DESC, id DESC`,
		args: hasSquadFilter ? [squadId] : [],
	});

	return result.rows.map((row) => mapObjective(row));
}

export async function createTask(
	objectiveId: string,
	data: CreateTaskInput,
	db?: DatabaseClient,
): Promise<Task> {
	const database = db ?? (await getDatabase());
	const timestamp = nowIso();
	const task: Task = {
		id: generateId(),
		objectiveId,
		assigneeId: data.assigneeId ?? null,
		title: data.title,
		description: data.description,
		status: data.status ?? "pending",
		result: data.result ?? null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await database.execute({
		sql: `INSERT INTO tasks (id, objective_id, assignee_id, title, description, status, result, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			task.id,
			task.objectiveId,
			task.assigneeId,
			task.title,
			task.description,
			task.status,
			task.result,
			task.createdAt,
			task.updatedAt,
		],
	});

	return task;
}

export async function updateTaskStatus(
	taskId: string,
	status: TaskStatus,
	result?: string,
	db?: DatabaseClient,
): Promise<Task | null> {
	const database = db ?? (await getDatabase());
	const updatedAt = nowIso();
	const response = await database.execute({
		sql: "UPDATE tasks SET status = ?, result = ?, updated_at = ? WHERE id = ?",
		args: [status, result ?? null, updatedAt, taskId],
	});

	if (response.rowsAffected === 0) {
		return null;
	}

	const resultSet = await database.execute({
		sql: "SELECT * FROM tasks WHERE id = ? LIMIT 1",
		args: [taskId],
	});
	const row = resultSet.rows[0];
	return row ? mapTask(row) : null;
}

export async function getTasksForObjective(
	objectiveId: string,
	db?: DatabaseClient,
): Promise<Task[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM tasks WHERE objective_id = ? ORDER BY created_at ASC, id ASC",
		args: [objectiveId],
	});

	return result.rows.map((row) => mapTask(row));
}

async function updateObjectiveFields(
	id: string,
	fields: Record<string, string>,
	db?: DatabaseClient,
): Promise<Objective | null> {
	const database = db ?? (await getDatabase());
	const entries = Object.entries(fields);

	if (entries.length === 0) {
		return getObjectiveRow(id, database);
	}

	const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
	const args = entries.map(([, value]) => value);
	const result = await database.execute({
		sql: `UPDATE objectives SET ${assignments} WHERE id = ?`,
		args: [...args, id],
	});

	if (result.rowsAffected === 0) {
		return null;
	}

	return getObjectiveRow(id, database);
}

async function getObjectiveRow(id: string, db: DatabaseClient): Promise<Objective | null> {
	const result = await db.execute({
		sql: "SELECT * FROM objectives WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];
	return row ? mapObjective(row) : null;
}

function mapObjective(row: Record<string, unknown>): Objective {
	return {
		id: asString(row.id),
		squadId: asString(row.squad_id),
		description: asString(row.description),
		status: asString(row.status) as ObjectiveStatus,
		plan: asNullableString(row.plan),
		revisionCount: asNumber(row.revision_count),
		branch: asNullableString(row.branch),
		prUrl: asNullableString(row.pr_url),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}

function mapTask(row: Record<string, unknown>): Task {
	return {
		id: asString(row.id),
		objectiveId: asString(row.objective_id),
		assigneeId: asNullableString(row.assignee_id),
		title: asString(row.title),
		description: asString(row.description),
		status: asString(row.status) as TaskStatus,
		result: asNullableString(row.result),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}
