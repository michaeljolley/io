import { AUTONOMY_TIERS, type AutonomyConfig, type Squad, type SquadMember } from '@io/shared';
import type { AutonomyTier } from '@io/shared';
import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from '../store/db.js';
import { Agent, type AgentConfig } from './agent.js';
import { getEventBus } from './event-bus.js';
import { type SkillDefinition, parseSkillContent, parseSkillFile } from './skill-parser.js';

const logger = () => createChildLogger('squad-manager');

// Active squads keyed by squad ID
const activeSquads = new Map<string, SquadRuntime>();

export interface SquadRuntime {
	squad: Squad;
	members: Map<string, Agent>; // keyed by role
	skills: Map<string, SkillDefinition>; // keyed by role
}

/** Create a new squad in the database and return it */
export async function createSquad(params: {
	name: string;
	projectPath: string;
	repoUrl?: string;
	universe?: string;
	autonomyTier?: AutonomyTier;
}): Promise<Squad> {
	const db = getDatabase();
	const id = crypto.randomUUID();
	const tier = params.autonomyTier ?? 'medium';
	const autonomyConfig = AUTONOMY_TIERS[tier];

	await db.execute({
		sql: `INSERT INTO squads (id, name, project_path, repo_url, universe, autonomy_tier, autonomy_config, status)
		      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
		args: [
			id,
			params.name,
			params.projectPath,
			params.repoUrl ?? null,
			params.universe ?? null,
			tier,
			JSON.stringify(autonomyConfig),
		],
	});

	const squad: Squad = {
		id,
		name: params.name,
		projectPath: params.projectPath,
		repoUrl: params.repoUrl,
		universe: params.universe,
		autonomyTier: tier,
		autonomyConfig,
		status: 'active',
		createdAt: new Date(),
	};

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'squad:created',
		squadId: id,
		squadName: params.name,
		data: { projectPath: params.projectPath, tier },
	});

	logger().info({ squadId: id, name: params.name }, 'Squad created');
	return squad;
}

/** Add a member to a squad */
export async function addMember(params: {
	squadId: string;
	skill: SkillDefinition;
	displayName: string;
	isVetoMember?: boolean;
}): Promise<SquadMember> {
	const db = getDatabase();
	const id = crypto.randomUUID();

	await db.execute({
		sql: `INSERT INTO squad_members (id, squad_id, display_name, role_name, skill_file_path, tools_allowed, is_veto_member, status)
		      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
		args: [
			id,
			params.squadId,
			params.displayName,
			params.skill.role,
			params.skill.filePath,
			JSON.stringify(params.skill.tools),
			params.isVetoMember ? 1 : 0,
		],
	});

	const member: SquadMember = {
		id,
		squadId: params.squadId,
		displayName: params.displayName,
		roleName: params.skill.role,
		skillFilePath: params.skill.filePath,
		toolsAllowed: params.skill.tools,
		isVetoMember: params.isVetoMember ?? false,
		status: 'active',
		createdAt: new Date(),
	};

	return member;
}

/** List all squads */
export async function listSquads(): Promise<Squad[]> {
	const db = getDatabase();
	const result = await db.execute("SELECT * FROM squads WHERE status = 'active'");

	return result.rows.map((row) => ({
		id: row.id as string,
		name: row.name as string,
		projectPath: row.project_path as string,
		repoUrl: (row.repo_url as string) || undefined,
		universe: (row.universe as string) || undefined,
		autonomyTier: row.autonomy_tier as AutonomyTier,
		autonomyConfig: JSON.parse((row.autonomy_config as string) || '{}') as AutonomyConfig,
		status: row.status as Squad['status'],
		createdAt: new Date(row.created_at as string),
	}));
}

/** Get a squad by name */
export async function getSquadByName(name: string): Promise<Squad | null> {
	const db = getDatabase();
	const result = await db.execute({
		sql: "SELECT * FROM squads WHERE name = ? AND status = 'active'",
		args: [name],
	});

	if (result.rows.length === 0) return null;
	const row = result.rows[0];

	return {
		id: row.id as string,
		name: row.name as string,
		projectPath: row.project_path as string,
		repoUrl: (row.repo_url as string) || undefined,
		universe: (row.universe as string) || undefined,
		autonomyTier: row.autonomy_tier as AutonomyTier,
		autonomyConfig: JSON.parse((row.autonomy_config as string) || '{}') as AutonomyConfig,
		status: row.status as Squad['status'],
		createdAt: new Date(row.created_at as string),
	};
}

/** Get squad members */
export async function getSquadMembers(squadId: string): Promise<SquadMember[]> {
	const db = getDatabase();
	const result = await db.execute({
		sql: "SELECT * FROM squad_members WHERE squad_id = ? AND status = 'active'",
		args: [squadId],
	});

	return result.rows.map((row) => ({
		id: row.id as string,
		squadId: row.squad_id as string,
		displayName: (row.display_name as string) || (row.role_name as string),
		roleName: row.role_name as string,
		skillFilePath: (row.skill_file_path as string) || undefined,
		toolsAllowed: JSON.parse((row.tools_allowed as string) || '[]') as string[],
		isVetoMember: Boolean(row.is_veto_member),
		status: row.status as SquadMember['status'],
		createdAt: new Date(row.created_at as string),
	}));
}

/** Disband a squad */
export async function disbandSquad(squadId: string): Promise<void> {
	const db = getDatabase();
	await db.execute({
		sql: "UPDATE squads SET status = 'disbanded' WHERE id = ?",
		args: [squadId],
	});
	await db.execute({
		sql: "UPDATE squad_members SET status = 'retired' WHERE squad_id = ?",
		args: [squadId],
	});

	// Destroy any running agents
	const runtime = activeSquads.get(squadId);
	if (runtime) {
		for (const agent of runtime.members.values()) {
			await agent.destroy().catch(() => {});
		}
		activeSquads.delete(squadId);
	}

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'squad:disbanded',
		squadId,
		squadName: '',
	});

	logger().info({ squadId }, 'Squad disbanded');
}

/** Boot a squad's agents (creates sessions for each member) */
export async function bootSquad(squad: Squad): Promise<SquadRuntime> {
	const members = await getSquadMembers(squad.id);
	const runtime: SquadRuntime = {
		squad,
		members: new Map(),
		skills: new Map(),
	};

	const squadContext = `Project: ${squad.name}\nPath: ${squad.projectPath}${squad.repoUrl ? `\nRepo: ${squad.repoUrl}` : ''}`;

	for (const member of members) {
		let skill: SkillDefinition;
		if (member.skillFilePath) {
			skill = parseSkillFile(member.skillFilePath);
		} else {
			// Fallback: generate a minimal skill
			skill = parseSkillContent(
				`---\nrole: ${member.roleName}\ntools: []\nveto: false\n---\nYou are the ${member.roleName}.`,
			);
		}

		runtime.skills.set(member.roleName, skill);

		const agent = new Agent({
			skill,
			squadId: squad.id,
			squadName: squad.name,
			model: 'claude-opus-4.6',
		});

		await agent.init(squadContext);
		runtime.members.set(member.roleName, agent);
	}

	activeSquads.set(squad.id, runtime);
	logger().info({ squadId: squad.id, memberCount: members.length }, 'Squad booted');
	return runtime;
}

/** Get a running squad's runtime */
export function getSquadRuntime(squadId: string): SquadRuntime | undefined {
	return activeSquads.get(squadId);
}

/** Delegate a message to a squad's team lead */
export async function delegateToSquad(squadId: string, message: string): Promise<string> {
	const runtime = activeSquads.get(squadId);
	if (!runtime) {
		throw new Error(`Squad ${squadId} is not running`);
	}

	const teamLead = runtime.members.get('team-lead');
	if (!teamLead) {
		throw new Error(`Squad ${squadId} has no team lead`);
	}

	return teamLead.send(message);
}
