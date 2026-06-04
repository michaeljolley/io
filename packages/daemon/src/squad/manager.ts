import { AUTONOMY_TIERS, SQUAD_COLORS, type AutonomyConfig, type Squad, type SquadMember } from '@io/shared';
import type { AutonomyTier } from '@io/shared';
import { loadConfig } from '../config.js';
import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from '../store/db.js';
import { Agent, type AgentConfig } from './agent.js';
import { getEventBus } from './event-bus.js';
import { selectModelForRole } from './model-selector.js';
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

	// Pick the next color from the palette based on existing squad count
	const countResult = await db.execute('SELECT COUNT(*) as cnt FROM squads');
	const existingCount = (countResult.rows[0]?.cnt as number) ?? 0;
	const color = SQUAD_COLORS[existingCount % SQUAD_COLORS.length]!;

	await db.execute({
		sql: `INSERT INTO squads (id, name, project_path, repo_url, universe, autonomy_tier, autonomy_config, color, status)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
		args: [
			id,
			params.name,
			params.projectPath,
			params.repoUrl ?? null,
			params.universe ?? null,
			tier,
			JSON.stringify(autonomyConfig),
			color,
		],
	});

	const squad: Squad = {
		id,
		name: params.name,
		projectPath: params.projectPath,
		repoUrl: params.repoUrl,
		universe: params.universe,
		color,
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
	persona?: string;
	isVetoMember?: boolean;
}): Promise<SquadMember> {
	const db = getDatabase();
	const id = crypto.randomUUID();

	await db.execute({
		sql: `INSERT INTO squad_members (id, squad_id, display_name, role_name, persona, skill_file_path, tools_allowed, is_veto_member, status)
		      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
		args: [
			id,
			params.squadId,
			params.displayName,
			params.skill.role,
			params.persona ?? null,
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
		persona: params.persona,
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
		color: (row.color as string) || '#38bdf8',
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
		color: (row.color as string) || '#38bdf8',
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
		persona: (row.persona as string) || undefined,
		skillFilePath: (row.skill_file_path as string) || undefined,
		toolsAllowed: JSON.parse((row.tools_allowed as string) || '[]') as string[],
		isVetoMember: Boolean(row.is_veto_member),
		status: row.status as SquadMember['status'],
		createdAt: new Date(row.created_at as string),
	}));
}

/** Disband a squad — soft-delete that preserves data for usage reports */
export async function disbandSquad(squadId: string): Promise<void> {
	const db = getDatabase();

	// Get squad name for disk cleanup and event
	const squad = await getSquadById(squadId);
	const squadName = squad?.name ?? '';

	// Mark squad and members as disbanded/retired
	await db.execute({
		sql: "UPDATE squads SET status = 'disbanded' WHERE id = ?",
		args: [squadId],
	});
	await db.execute({
		sql: "UPDATE squad_members SET status = 'retired' WHERE squad_id = ?",
		args: [squadId],
	});

	// Cancel schedules targeting this squad
	await db.execute({
		sql: "DELETE FROM schedules WHERE target_type = 'squad' AND target_id = ?",
		args: [squadId],
	});

	// Auto-resolve pending inbox entries
	await db.execute({
		sql: "UPDATE inbox_entries SET status = 'dismissed', response = 'Squad was disbanded', resolved_at = CURRENT_TIMESTAMP WHERE squad_id = ? AND status IN ('unread', 'pending')",
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

	// Clean up disk artifacts (wiki folder + skill files)
	if (squadName) {
		const { rmSync, existsSync } = await import('node:fs');
		const { join } = await import('node:path');
		const { homedir } = await import('node:os');
		const home = homedir();
		const wikiDir = join(home, '.io', 'wiki', 'squads', squadName);
		if (existsSync(wikiDir)) {
			rmSync(wikiDir, { recursive: true, force: true });
		}
		const skillsDir = join(home, '.io', 'squads', squadName);
		if (existsSync(skillsDir)) {
			rmSync(skillsDir, { recursive: true, force: true });
		}
	}

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'squad:disbanded',
		squadId,
		squadName,
	});

	logger().info({ squadId, squadName }, 'Squad disbanded');
}

/** Rename a squad member's display name */
export async function renameMember(memberId: string, newDisplayName: string): Promise<void> {
	const db = getDatabase();
	await db.execute({
		sql: 'UPDATE squad_members SET display_name = ? WHERE id = ?',
		args: [newDisplayName, memberId],
	});
	logger().info({ memberId, newDisplayName }, 'Member renamed');
}

/** Remove (retire) a member from a squad */
export async function removeMember(memberId: string, squadId: string): Promise<void> {
	const db = getDatabase();
	await db.execute({
		sql: "UPDATE squad_members SET status = 'retired' WHERE id = ?",
		args: [memberId],
	});

	// Destroy running agent if squad is booted
	const runtime = activeSquads.get(squadId);
	if (runtime) {
		// Find and remove the agent by member ID
		for (const [role, agent] of runtime.members.entries()) {
			const members = await getSquadMembers(squadId);
			const member = members.find((m) => m.id === memberId);
			if (member && member.roleName === role) {
				await agent.destroy().catch(() => {});
				runtime.members.delete(role);
				break;
			}
		}
	}

	logger().info({ memberId, squadId }, 'Member removed from squad');
}

/** Find a squad member by role name or display name */
export async function findMember(squadId: string, identifier: string): Promise<SquadMember | null> {
	const members = await getSquadMembers(squadId);
	return (
		members.find(
			(m) =>
				m.roleName.toLowerCase() === identifier.toLowerCase() ||
				m.displayName.toLowerCase() === identifier.toLowerCase(),
		) ?? null
	);
}

/** Retheme a squad with a new universe — updates display names and personas */
export async function rethemeSquad(
	squadId: string,
	newUniverse: string,
	assignments: { role: string; displayName: string; persona: string }[],
): Promise<void> {
	const db = getDatabase();

	// Update squad universe
	await db.execute({
		sql: 'UPDATE squads SET universe = ? WHERE id = ?',
		args: [newUniverse, squadId],
	});

	// Update each member
	for (const assignment of assignments) {
		await db.execute({
			sql: 'UPDATE squad_members SET display_name = ?, persona = ? WHERE squad_id = ? AND role_name = ?',
			args: [assignment.displayName, assignment.persona, squadId, assignment.role],
		});
	}

	// If squad is running, destroy and reboot agents
	const runtime = activeSquads.get(squadId);
	if (runtime) {
		for (const agent of runtime.members.values()) {
			await agent.destroy().catch(() => {});
		}
		activeSquads.delete(squadId);

		// Reload squad data and reboot
		const squad = await getSquadById(squadId);
		if (squad) {
			await bootSquad(squad);
		}
	}

	logger().info({ squadId, universe: newUniverse }, 'Squad rethemed');
}

/** Get squad by ID */
export async function getSquadById(squadId: string): Promise<Squad | null> {
	const db = getDatabase();
	const result = await db.execute({
		sql: 'SELECT * FROM squads WHERE id = ?',
		args: [squadId],
	});

	if (result.rows.length === 0) return null;
	const row = result.rows[0];

	return {
		id: row.id as string,
		name: row.name as string,
		projectPath: row.project_path as string,
		repoUrl: (row.repo_url as string) || undefined,
		universe: (row.universe as string) || undefined,
		color: (row.color as string) || '#38bdf8',
		autonomyTier: row.autonomy_tier as AutonomyTier,
		autonomyConfig: JSON.parse((row.autonomy_config as string) || '{}') as AutonomyConfig,
		status: row.status as Squad['status'],
		createdAt: new Date(row.created_at as string),
	};
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
			model: selectModelForRole(member.roleName, 'meeting'),
			byok: loadConfig().byok,
			identity: {
				displayName: member.displayName,
				persona: member.persona,
				universe: squad.universe,
			},
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
export async function delegateToSquad(squadId: string, message: string, attachments?: Array<{ type: 'file'; path: string; displayName?: string }>): Promise<string> {
	const runtime = activeSquads.get(squadId);
	if (!runtime) {
		throw new Error(`Squad ${squadId} is not running`);
	}

	const teamLead = runtime.members.get('technical-pm');
	if (!teamLead) {
		throw new Error(`Squad ${squadId} has no team lead`);
	}

	return teamLead.send(message, attachments);
}
