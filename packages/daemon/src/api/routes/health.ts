import { Router } from 'express';
import { getHealthStatus } from '../../copilot/health-monitor.js';

export function healthRouter(): Router {
	const router = Router();

	router.get('/health', (_req, res) => {
		const health = getHealthStatus();
		res.json({
			status: health.status,
			uptime: health.uptime,
			copilotConnected: health.copilotConnected,
			lastCheck: health.lastCheck.toISOString(),
		});
	});

	return router;
}
