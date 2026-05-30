import { Router } from 'express';
import { getSquadInstances } from '../../squad/execution/instance.js';
import { runInstance } from '../../squad/execution/runner.js';
import { getSquadByName, getSquadMembers, listSquads } from '../../squad/manager.js';

export function squadsRouter(): Router {
	const router = Router();

	/**
	 * GET /api/squads
	 * List all active squads.
	 */
	router.get('/squads', async (_req, res) => {
		try {
			const squads = await listSquads();
			const results = await Promise.all(
				squads.map(async (s) => {
					const members = await getSquadMembers(s.id);
					const instances = getSquadInstances(s.id);
					return {
						id: s.id,
						name: s.name,
						projectPath: s.projectPath,
						repoUrl: s.repoUrl,
						universe: s.universe,
						autonomyTier: s.autonomyTier,
						status: s.status,
						memberCount: members.length,
						activeInstances: instances.filter(
							(i) => i.status !== 'complete' && i.status !== 'failed',
						).length,
						createdAt: s.createdAt.toISOString(),
					};
				}),
			);
			res.json({ squads: results });
		} catch (err) {
			res.status(500).json({ error: 'Failed to list squads' });
		}
	});

	/**
	 * GET /api/squads/:name
	 * Get detailed squad info.
	 */
	router.get('/squads/:name', async (req, res) => {
		try {
			const squad = await getSquadByName(req.params.name);
			if (!squad) {
				res.status(404).json({ error: `Squad '${req.params.name}' not found` });
				return;
			}

			const members = await getSquadMembers(squad.id);
			const instances = getSquadInstances(squad.id);

			// Build a map of role -> current task (from active instances)
			const currentTasks = new Map<string, string>();
			for (const inst of instances) {
				if (inst.status !== 'complete' && inst.status !== 'failed') {
					for (const task of inst.tasks) {
						if (task.status === 'in_progress') {
							currentTasks.set(task.assignedTo, task.description);
						}
					}
				}
			}

			res.json({
				squad: {
					id: squad.id,
					name: squad.name,
					projectPath: squad.projectPath,
					repoUrl: squad.repoUrl,
					universe: squad.universe,
					autonomyTier: squad.autonomyTier,
					autonomyConfig: squad.autonomyConfig,
					status: squad.status,
					createdAt: squad.createdAt.toISOString(),
				},
				members: members.map((m) => ({
					id: m.id,
					displayName: m.displayName,
					role: m.roleName,
					persona: m.persona,
					veto: m.isVetoMember,
					tools: m.toolsAllowed,
					status: m.status,
					currentTask: currentTasks.get(m.roleName) ?? null,
				})),
				instances: instances.map((i) => ({
					id: i.id,
					status: i.status,
					issueRef: i.issueRef,
					branch: i.branch,
					taskCount: i.tasks.length,
					tasksComplete: i.tasks.filter((t) => t.status === 'done').length,
				})),
			});
		} catch (err) {
			res.status(500).json({ error: 'Failed to get squad' });
		}
	});

	/**
	 * POST /api/squads/:name/run
	 * Spawn a new instance for a squad.
	 * Body: { objective: string, issueRef?: string }
	 */
	router.post('/squads/:name/run', async (req, res) => {
		try {
			const squad = await getSquadByName(req.params.name);
			if (!squad) {
				res.status(404).json({ error: `Squad '${req.params.name}' not found` });
				return;
			}

			const { objective, issueRef } = req.body as {
				objective?: string;
				issueRef?: string;
			};

			if (!objective) {
				res.status(400).json({ error: 'objective is required' });
				return;
			}

			// Run asynchronously — return immediately with instance ID
			const instancePromise = runInstance({ squad, objective, issueRef });

			// We don't await — return accepted status
			// The client can poll /api/squads/:name for progress
			instancePromise.catch(() => {}); // prevent unhandled rejection

			res.status(202).json({
				message: `Instance starting for squad '${squad.name}'`,
				objective,
			});
		} catch (err) {
			res.status(500).json({ error: 'Failed to start instance' });
		}
	});

	return router;
}
