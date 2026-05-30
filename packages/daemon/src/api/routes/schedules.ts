import { Router } from 'express';
import {
	type ScheduleTargetType,
	createSchedule,
	deleteSchedule,
	getSchedule,
	listSchedules,
	updateSchedule,
} from '../../store/schedules.js';

export function schedulesRouter(): Router {
	const router = Router();

	/**
	 * GET /api/schedules
	 * List all schedules. Query param: enabled=true to filter.
	 */
	router.get('/schedules', async (req, res) => {
		try {
			const enabledOnly = req.query.enabled === 'true';
			const schedules = await listSchedules(enabledOnly || undefined);
			res.json({ schedules });
		} catch {
			res.status(500).json({ error: 'Failed to list schedules' });
		}
	});

	/**
	 * GET /api/schedules/:id
	 * Get a single schedule.
	 */
	router.get('/schedules/:id', async (req, res) => {
		try {
			const schedule = await getSchedule(req.params.id);
			if (!schedule) {
				res.status(404).json({ error: 'Schedule not found' });
				return;
			}
			res.json({ schedule });
		} catch {
			res.status(500).json({ error: 'Failed to get schedule' });
		}
	});

	/**
	 * POST /api/schedules
	 * Create a new schedule.
	 * Body: { name, targetType, targetId?, cron, prompt, enabled? }
	 */
	router.post('/schedules', async (req, res) => {
		try {
			const { name, targetType, targetId, cron, prompt, enabled } = req.body as {
				name?: string;
				targetType?: ScheduleTargetType;
				targetId?: string;
				cron?: string;
				prompt?: string;
				enabled?: boolean;
			};

			if (!name || !targetType || !cron || !prompt) {
				res.status(400).json({ error: 'name, targetType, cron, and prompt are required' });
				return;
			}

			if (targetType !== 'squad' && targetType !== 'orchestrator') {
				res.status(400).json({ error: 'targetType must be "squad" or "orchestrator"' });
				return;
			}

			const schedule = await createSchedule({ name, targetType, targetId, cron, prompt, enabled });
			res.status(201).json({ schedule });
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to create schedule';
			res.status(400).json({ error: msg });
		}
	});

	/**
	 * PATCH /api/schedules/:id
	 * Update a schedule (partial). Body: { name?, cron?, prompt?, enabled? }
	 */
	router.patch('/schedules/:id', async (req, res) => {
		try {
			const existing = await getSchedule(req.params.id);
			if (!existing) {
				res.status(404).json({ error: 'Schedule not found' });
				return;
			}

			const { name, cron, prompt, enabled } = req.body as {
				name?: string;
				cron?: string;
				prompt?: string;
				enabled?: boolean;
			};

			await updateSchedule(req.params.id, { name, cron, prompt, enabled });
			const updated = await getSchedule(req.params.id);
			res.json({ schedule: updated });
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to update schedule';
			res.status(400).json({ error: msg });
		}
	});

	/**
	 * DELETE /api/schedules/:id
	 * Delete a schedule.
	 */
	router.delete('/schedules/:id', async (req, res) => {
		try {
			await deleteSchedule(req.params.id);
			res.json({ status: 'ok' });
		} catch {
			res.status(500).json({ error: 'Failed to delete schedule' });
		}
	});

	return router;
}
