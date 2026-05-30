import { CopilotClient } from '@github/copilot-sdk';
import type { Logger } from 'pino';
import { createChildLogger } from '../logging/logger.js';

let client: CopilotClient | undefined;
let logger: Logger;

function getLogger(): Logger {
	if (!logger) {
		logger = createChildLogger('copilot-client');
	}
	return logger;
}

export async function getClient(): Promise<CopilotClient> {
	if (!client) {
		client = new CopilotClient();
		await client.start();
		getLogger().info('Copilot client started');
	}
	return client;
}

export async function resetClient(): Promise<void> {
	if (client) {
		getLogger().warn('Resetting Copilot client');
		try {
			await client.stop();
		} catch (err) {
			getLogger().error({ err }, 'Error stopping client during reset');
		}
		client = undefined;
	}
}

export async function stopClient(): Promise<void> {
	if (client) {
		await client.stop();
		client = undefined;
		getLogger().info('Copilot client stopped');
	}
}
