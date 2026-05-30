import type { InstanceStatus, Squad } from '@io/shared';
import { createChildLogger } from '../../logging/logger.js';
import { getDatabase } from '../../store/db.js';
import { getEventBus } from '../event-bus.js';
import { type SquadRuntime, getSquadMembers, getSquadRuntime } from '../manager.js';
import { type WorktreeInfo, createWorktree, removeWorktree } from './worktree.js';

const logger = () => createChildLogger('instance');

export interface InstanceTask {
	id: string;
	description: string;
	assignedTo: string; // agent role
	status: 'pending' | 'in_progress' | 'done' | 'failed';
	result?: string;
}

export interface Instance {
	id: string;
	squadId: string;
	issueRef?: string;
	worktree: WorktreeInfo | null;
	branch: string | null;
	status: InstanceStatus;
	tasks: InstanceTask[];
	meetingLog: string[];
}

const activeInstances = new Map<string, Instance>();

/**
 * Create a new instance for a squad. Enforces max 3 per squad.
 */
export async function createInstance(params: {
	squad: Squad;
	issueRef?: string;
	objective: string;
}): Promise<Instance> {
	const log = logger();
	const db = getDatabase();

	// Enforce instance limit
	const existingResult = await db.execute({
		sql: "SELECT COUNT(*) as cnt FROM squad_instances WHERE squad_id = ? AND status NOT IN ('complete', 'failed')",
		args: [params.squad.id],
	});
	const count = (existingResult.rows[0]?.cnt as number) ?? 0;
	if (count >= 3) {
		throw new Error(`Squad '${params.squad.name}' already has ${count} active instances (max 3)`);
	}

	const id = crypto.randomUUID();

	// Create worktree if project has git
	let worktree: WorktreeInfo | null = null;
	try {
		worktree = createWorktree({
			repoPath: params.squad.projectPath,
			squadName: params.squad.name,
			instanceId: id,
		});
	} catch (err) {
		log.warn({ err }, 'Could not create worktree, proceeding without isolation');
	}

	// Persist to DB
	await db.execute({
		sql: `INSERT INTO squad_instances (id, squad_id, issue_ref, worktree_path, branch_name, status)
		      VALUES (?, ?, ?, ?, ?, 'planning')`,
		args: [
			id,
			params.squad.id,
			params.issueRef ?? null,
			worktree?.path ?? null,
			worktree?.branch ?? null,
		],
	});

	const instance: Instance = {
		id,
		squadId: params.squad.id,
		issueRef: params.issueRef,
		worktree,
		branch: worktree?.branch ?? null,
		status: 'planning',
		tasks: [],
		meetingLog: [],
	};

	activeInstances.set(id, instance);

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: 'instance:created',
		squadId: params.squad.id,
		instanceId: id,
		data: { issueRef: params.issueRef, objective: params.objective },
	});

	log.info({ instanceId: id, squadId: params.squad.id }, 'Instance created');
	return instance;
}

/**
 * Transition instance to a new status.
 */
export async function transitionInstance(
	instanceId: string,
	newStatus: InstanceStatus,
): Promise<void> {
	const db = getDatabase();
	const instance = activeInstances.get(instanceId);
	if (!instance) throw new Error(`Instance ${instanceId} not found`);

	const validTransitions: Record<InstanceStatus, InstanceStatus[]> = {
		planning: ['meeting', 'failed'],
		meeting: ['working', 'failed'],
		working: ['reviewing', 'failed'],
		reviewing: ['complete', 'working', 'failed'],
		complete: [],
		failed: [],
	};

	const allowed = validTransitions[instance.status];
	if (!allowed.includes(newStatus)) {
		throw new Error(`Invalid transition: ${instance.status} → ${newStatus}`);
	}

	instance.status = newStatus;
	const completedAt =
		newStatus === 'complete' || newStatus === 'failed' ? new Date().toISOString() : null;

	await db.execute({
		sql: 'UPDATE squad_instances SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?',
		args: [newStatus, completedAt, instanceId],
	});

	const eventType =
		newStatus === 'meeting'
			? 'instance:meeting_started'
			: newStatus === 'working'
				? 'instance:work_started'
				: newStatus === 'complete'
					? 'instance:complete'
					: newStatus === 'failed'
						? 'instance:failed'
						: ('instance:created' as const);

	await getEventBus().emit({
		id: crypto.randomUUID(),
		timestamp: new Date(),
		type: eventType,
		squadId: instance.squadId,
		instanceId,
		data: { from: instance.status, to: newStatus },
	});
}

/**
 * Clean up a completed/failed instance (remove worktree).
 */
export async function cleanupInstance(instanceId: string, squad: Squad): Promise<void> {
	const instance = activeInstances.get(instanceId);
	if (!instance) return;

	if (instance.worktree && instance.branch) {
		removeWorktree({
			repoPath: squad.projectPath,
			worktreePath: instance.worktree.path,
			branch: instance.branch,
		});
	}

	activeInstances.delete(instanceId);
}

/** Get an active instance */
export function getInstance(instanceId: string): Instance | undefined {
	return activeInstances.get(instanceId);
}

/** Get all active instances for a squad */
export function getSquadInstances(squadId: string): Instance[] {
	return [...activeInstances.values()].filter((i) => i.squadId === squadId);
}
