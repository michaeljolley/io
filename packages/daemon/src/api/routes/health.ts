import { Router } from 'express';

export function healthRouter(): Router {
	const router = Router();

	const startTime = Date.now();

	router.get('/health', (_req, res) => {
		res.json({
			status: 'healthy',
			uptime: Math.floor((Date.now() - startTime) / 1000),
			copilotConnected: false, // TODO: check actual connection
			activeSquads: 0,
			activeInstances: 0,
		});
	});

	return router;
}
