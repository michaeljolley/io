#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { initNotifications } from './api/notifications.js';
import { createApiServer } from './api/server.js';
import { loadConfig } from './config.js';
import { stopClient } from './copilot/client.js';
import { startHealthMonitor, stopHealthMonitor } from './copilot/health-monitor.js';
import { destroyOrchestrator, initOrchestrator } from './copilot/orchestrator.js';
import { getLogger, initLogger } from './logging/logger.js';
import { seedPricing } from './models/index.js';
import { startScheduler, stopScheduler } from './scheduler/engine.js';
import { initSkills } from './skills/index.js';
import { getEventBus } from './squad/event-bus.js';
import { initActivityLogger } from './store/activity.js';
import { closeDatabase, initDatabase } from './store/db.js';
import { initWiki } from './wiki/index.js';

const config = loadConfig();

// Ensure data directory exists
mkdirSync(config.dataDir, { recursive: true });

// Initialize logger first — other modules depend on it
const logger = initLogger(config);

// Initialize wiki directory structure
initWiki(config.dataDir);

// Initialize skills directory
initSkills(config.dataDir);
logger.info(
	{
		config: {
			apiPort: config.apiPort,
			logLevel: config.logLevel,
			defaultModel: config.defaultModel,
			dataDir: config.dataDir,
			byok: config.byok
				? { type: config.byok.type, baseUrl: config.byok.baseUrl }
				: null,
		},
	},
	'IO daemon starting',
);

// Create API server
const apiServer = createApiServer(config);

async function start(): Promise<void> {
	// Initialize database
	await initDatabase(config.dataDir);

	// Seed model pricing defaults
	await seedPricing();

	// Initialize notification system (event bus → WebSocket broadcast)
	initNotifications();

	// Initialize activity logger (event bus → SQLite)
	initActivityLogger(getEventBus());

	// Initialize Copilot orchestrator
	await initOrchestrator(config);

	// Start health monitoring
	startHealthMonitor();

	// Start schedule engine (evaluates cron schedules every 60s)
	startScheduler();

	await apiServer.start();
	logger.info('IO daemon ready');
}

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;

	const log = getLogger();
	log.info({ signal }, 'Shutting down...');

	// Stop accepting new requests
	stopHealthMonitor();
	stopScheduler();

	// Stop API server (closes WebSocket connections)
	await apiServer.stop();

	// Destroy orchestrator session (drains queue)
	await destroyOrchestrator();

	// Stop Copilot SDK client
	await stopClient();

	// Clear event bus
	getEventBus().clear();

	// Close database
	closeDatabase();

	log.info('Shutdown complete');
	process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
	const log = getLogger();
	log.fatal({ err }, 'Uncaught exception');
	shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
	const log = getLogger();
	log.error({ err: reason }, 'Unhandled rejection');
});

start().catch((err) => {
	logger.fatal({ err }, 'Failed to start IO daemon');
	process.exit(1);
});
