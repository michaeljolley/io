import { Router } from 'express';
import { getAllPricing, queryUsage, refreshPricing } from '../../models/index.js';

export function usageRouter(): Router {
	const router = Router();

	/**
	 * GET /api/usage
	 * Query token usage with optional filters.
	 * Query params: squadId, agentRole, model, since, until
	 */
	router.get('/usage', async (req, res) => {
		try {
			const filters = {
				squadId: req.query.squadId as string | undefined,
				agentRole: req.query.agentRole as string | undefined,
				model: req.query.model as string | undefined,
				since: req.query.since as string | undefined,
				until: req.query.until as string | undefined,
			};

			const result = await queryUsage(filters);
			res.json(result);
		} catch (err) {
			res.status(500).json({ error: 'Failed to query usage' });
		}
	});

	/**
	 * GET /api/usage/pricing
	 * Get current model pricing.
	 */
	router.get('/usage/pricing', async (_req, res) => {
		try {
			const pricing = await getAllPricing();
			res.json({ pricing });
		} catch (err) {
			res.status(500).json({ error: 'Failed to get pricing' });
		}
	});

	/**
	 * POST /api/usage/pricing/refresh
	 * Trigger a pricing refresh.
	 */
	router.post('/usage/pricing/refresh', async (_req, res) => {
		try {
			await refreshPricing();
			const pricing = await getAllPricing();
			res.json({ message: 'Pricing refreshed', pricing });
		} catch (err) {
			res.status(500).json({ error: 'Failed to refresh pricing' });
		}
	});

	return router;
}
