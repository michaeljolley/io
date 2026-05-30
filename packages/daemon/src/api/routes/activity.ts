import { Router } from 'express';
import { type ActivityType, queryActivity } from '../../store/activity.js';

export function activityRouter(): Router {
	const router = Router();

	/**
	 * GET /api/activity
	 * Query agent activity log with optional filters.
	 * Query params: squad, instance, agent, type, limit, offset
	 */
	router.get('/activity', async (req, res) => {
		try {
			const entries = await queryActivity({
				squadId: req.query.squad as string | undefined,
				instanceId: req.query.instance as string | undefined,
				agentRole: req.query.agent as string | undefined,
				activityType: req.query.type as ActivityType | undefined,
				limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
				offset: req.query.offset ? Number.parseInt(req.query.offset as string, 10) : undefined,
			});
			res.json({ entries });
		} catch (err) {
			res.status(500).json({ error: 'Failed to query activity' });
		}
	});

	return router;
}
