import pino from 'pino';
import type { IOConfig } from '../config.js';

let rootLogger: pino.Logger;

export function initLogger(config: IOConfig): pino.Logger {
	rootLogger = pino({
		level: config.logLevel,
		transport:
			process.env.NODE_ENV !== 'production'
				? { target: 'pino-pretty', options: { colorize: true } }
				: undefined,
	});
	return rootLogger;
}

export function getLogger(): pino.Logger {
	if (!rootLogger) {
		throw new Error('Logger not initialized. Call initLogger() first.');
	}
	return rootLogger;
}

export function createChildLogger(name: string, meta?: Record<string, unknown>): pino.Logger {
	return getLogger().child({ component: name, ...meta });
}
