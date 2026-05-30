import { createChildLogger } from '../logging/logger.js';
import { getClient, resetClient } from './client.js';

const logger = () => createChildLogger('health-monitor');

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let startTime: number = Date.now();

export interface HealthStatus {
	status: 'healthy' | 'degraded' | 'unhealthy';
	uptime: number;
	copilotConnected: boolean;
	lastCheck: Date;
}

let lastStatus: HealthStatus = {
	status: 'healthy',
	uptime: 0,
	copilotConnected: false,
	lastCheck: new Date(),
};

/**
 * Start periodic health monitoring of the Copilot SDK connection.
 * Attempts reconnect if connection is lost.
 */
export function startHealthMonitor(intervalMs = 30_000): void {
	startTime = Date.now();

	healthCheckInterval = setInterval(async () => {
		await checkHealth();
	}, intervalMs);

	// Initial check
	checkHealth();
}

export function stopHealthMonitor(): void {
	if (healthCheckInterval) {
		clearInterval(healthCheckInterval);
		healthCheckInterval = null;
	}
}

export function getHealthStatus(): HealthStatus {
	return {
		...lastStatus,
		uptime: Math.floor((Date.now() - startTime) / 1000),
	};
}

async function checkHealth(): Promise<void> {
	const log = logger();

	try {
		// Verify we can get the client (it auto-starts if needed)
		const client = await getClient();
		lastStatus = {
			status: 'healthy',
			uptime: Math.floor((Date.now() - startTime) / 1000),
			copilotConnected: true,
			lastCheck: new Date(),
		};
	} catch (err) {
		log.warn({ err }, 'Health check failed — Copilot client unavailable');
		lastStatus = {
			status: 'unhealthy',
			uptime: Math.floor((Date.now() - startTime) / 1000),
			copilotConnected: false,
			lastCheck: new Date(),
		};

		// Attempt reconnect
		try {
			log.info('Attempting Copilot client reconnect...');
			await resetClient();
			await getClient();
			log.info('Copilot client reconnected successfully');
			lastStatus.status = 'healthy';
			lastStatus.copilotConnected = true;
		} catch (reconnectErr) {
			log.error({ err: reconnectErr }, 'Reconnect failed');
		}
	}
}
