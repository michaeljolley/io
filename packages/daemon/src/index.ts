#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { createApiServer } from './api/server.js';
import { loadConfig } from './config.js';
import { stopClient } from './copilot/client.js';
import { destroyOrchestrator, initOrchestrator } from './copilot/orchestrator.js';
import { getLogger, initLogger } from './logging/logger.js';
import { seedPricing } from './models/index.js';
import { closeDatabase, initDatabase } from './store/db.js';

const config = loadConfig();

// Ensure data directory exists
mkdirSync(config.dataDir, { recursive: true });

const logger = initLogger(config);
logger.info({ config: { ...config, dataDir: config.dataDir } }, 'IO daemon starting');

// Create API server
const apiServer = createApiServer(config);

async function start(): Promise<void> {
	// Initialize database
	await initDatabase(config.dataDir);

	// Seed model pricing defaults
	await seedPricing();

	// Initialize Copilot orchestrator
	await initOrchestrator(config);

	await apiServer.start();
	logger.info('IO daemon ready');
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
	const log = getLogger();
	log.info({ signal }, 'Shutting down...');

	await apiServer.stop();
	await destroyOrchestrator();
	await stopClient();
	closeDatabase();

	log.info('Shutdown complete');
	process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
	logger.fatal({ err }, 'Failed to start IO daemon');
	process.exit(1);
});
