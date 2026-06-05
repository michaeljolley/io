import type { Squad, SquadConfig, SquadMember, SquadStatus } from "@io/shared";
import {
	type DatabaseClient,
	asNullableString,
	asString,
	generateId,
	getDatabase,
	nowIso,
	parseJson,
	serializeJson,
} from "./db.js";

export interface CreateSquadInput {
	name: string;
	repoUrl: string;
	repoOwner: string;
	repoName: string;
	status?: SquadStatus;
	config: SquadConfig;
}

export interface UpdateSquadInput {
	name?: string;
	repoUrl?: string;
	repoOwner?: string;
	repoName?: string;
	status?: SquadStatus;
	config?: SquadConfig;
}

export interface CreateSquadMemberInput {
	role: SquadMember["role"];
	name: string;
	systemPrompt: string;
	model?: string | null;
}

export interface SquadRecord extends Squad {
	members: SquadMember[];
}

export async function createSquad(data: CreateSquadInput, db?: DatabaseClient): Promise<Squad> {
	const database = db ?? (await getDatabase());
	const timestamp = nowIso();
	const squad: Squad = {
		id: generateId(),
		name: data.name,
		repoUrl: data.repoUrl,
		repoOwner: data.repoOwner,
		repoName: data.repoName,
		status: data.status ?? "active",
		config: data.config,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await database.execute({
		sql: `INSERT INTO squads (id, name, repo_url, repo_owner, repo_name, status, config, created_at, updated_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			squad.id,
			squad.name,
			squad.repoUrl,
			squad.repoOwner,
			squad.repoName,
			squad.status,
			serializeJson(squad.config),
			squad.createdAt,
			squad.updatedAt,
		],
	});

	return squad;
}

export async function getSquad(id: string, db?: DatabaseClient): Promise<SquadRecord | null> {
	const database = db ?? (await getDatabase());
	const squadResult = await database.execute({
		sql: "SELECT * FROM squads WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = squadResult.rows[0];

	if (!row) {
		return null;
	}

	const [squad, members] = await Promise.all([
		Promise.resolve(mapSquad(row)),
		getMembers(id, database),
	]);

	return { ...squad, members };
}

export async function listSquads(db?: DatabaseClient): Promise<Squad[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute("SELECT * FROM squads ORDER BY created_at DESC, id DESC");

	return result.rows.map((row) => mapSquad(row));
}

export async function updateSquad(
	id: string,
	data: UpdateSquadInput,
	db?: DatabaseClient,
): Promise<Squad | null> {
	const database = db ?? (await getDatabase());
	const existing = await getSquadRow(id, database);

	if (!existing) {
		return null;
	}

	const updatedAt = nowIso();
	const squad: Squad = {
		id: existing.id,
		name: data.name ?? existing.name,
		repoUrl: data.repoUrl ?? existing.repoUrl,
		repoOwner: data.repoOwner ?? existing.repoOwner,
		repoName: data.repoName ?? existing.repoName,
		status: data.status ?? existing.status,
		config: data.config ?? existing.config,
		createdAt: existing.createdAt,
		updatedAt,
	};

	await database.execute({
		sql: `UPDATE squads
		      SET name = ?, repo_url = ?, repo_owner = ?, repo_name = ?, status = ?, config = ?, updated_at = ?
		      WHERE id = ?`,
		args: [
			squad.name,
			squad.repoUrl,
			squad.repoOwner,
			squad.repoName,
			squad.status,
			serializeJson(squad.config),
			squad.updatedAt,
			id,
		],
	});

	return squad;
}

export async function deleteSquad(id: string, db?: DatabaseClient): Promise<boolean> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "DELETE FROM squads WHERE id = ?",
		args: [id],
	});

	return result.rowsAffected > 0;
}

export async function getSquadByRepo(
	repoOwner: string,
	repoName: string,
	db?: DatabaseClient,
): Promise<SquadRecord | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM squads WHERE repo_owner = ? AND repo_name = ? LIMIT 1",
		args: [repoOwner, repoName],
	});
	const row = result.rows[0];

	if (!row) {
		return null;
	}

	const squad = mapSquad(row);
	const members = await getMembers(squad.id, database);
	return { ...squad, members };
}

export async function addMember(
	squadId: string,
	data: CreateSquadMemberInput,
	db?: DatabaseClient,
): Promise<SquadMember> {
	const database = db ?? (await getDatabase());
	const member: SquadMember = {
		id: generateId(),
		squadId,
		role: data.role,
		name: data.name,
		systemPrompt: data.systemPrompt,
		model: data.model ?? null,
		createdAt: nowIso(),
	};

	await database.execute({
		sql: `INSERT INTO squad_members (id, squad_id, role, name, system_prompt, model, created_at)
		      VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [
			member.id,
			member.squadId,
			member.role,
			member.name,
			member.systemPrompt,
			member.model,
			member.createdAt,
		],
	});

	return member;
}

export async function removeMember(memberId: string, db?: DatabaseClient): Promise<boolean> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "DELETE FROM squad_members WHERE id = ?",
		args: [memberId],
	});

	return result.rowsAffected > 0;
}

export async function getMembers(squadId: string, db?: DatabaseClient): Promise<SquadMember[]> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM squad_members WHERE squad_id = ? ORDER BY created_at ASC, id ASC",
		args: [squadId],
	});

	return result.rows.map((row) => mapMember(row));
}

export async function getMember(
	memberId: string,
	db?: DatabaseClient,
): Promise<SquadMember | null> {
	const database = db ?? (await getDatabase());
	const result = await database.execute({
		sql: "SELECT * FROM squad_members WHERE id = ? LIMIT 1",
		args: [memberId],
	});
	const row = result.rows[0];

	return row ? mapMember(row) : null;
}

async function getSquadRow(id: string, db: DatabaseClient): Promise<Squad | null> {
	const result = await db.execute({
		sql: "SELECT * FROM squads WHERE id = ? LIMIT 1",
		args: [id],
	});
	const row = result.rows[0];

	return row ? mapSquad(row) : null;
}

function mapSquad(row: Record<string, unknown>): Squad {
	return {
		id: asString(row.id),
		name: asString(row.name),
		repoUrl: asString(row.repo_url),
		repoOwner: asString(row.repo_owner),
		repoName: asString(row.repo_name),
		status: asString(row.status) as SquadStatus,
		config: parseJson<SquadConfig>(asString(row.config)),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	};
}

function mapMember(row: Record<string, unknown>): SquadMember {
	return {
		id: asString(row.id),
		squadId: asString(row.squad_id),
		role: asString(row.role),
		name: asString(row.name),
		systemPrompt: asString(row.system_prompt),
		model: asNullableString(row.model),
		createdAt: asString(row.created_at),
	};
}
