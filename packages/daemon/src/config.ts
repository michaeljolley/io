import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '@io/shared';

export interface IOConfig {
	apiPort: number;
	logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
	defaultModel: string;
	maxInstancesPerSquad: number;
	dataDir: string;
	pricing: {
		refreshIntervalHours: number;
	};
}

function resolveDataDir(dir: string): string {
	if (dir.startsWith('~')) {
		return join(homedir(), dir.slice(1));
	}
	return dir;
}

export function loadConfig(): IOConfig {
	const dataDir = resolveDataDir(process.env.IO_DATA_DIR ?? DEFAULT_CONFIG.dataDir);
	const configPath = join(dataDir, 'config.json');

	let fileConfig: Partial<IOConfig> = {};
	if (existsSync(configPath)) {
		const raw = readFileSync(configPath, 'utf-8');
		fileConfig = JSON.parse(raw);
	}

	return {
		apiPort: Number(process.env.IO_PORT) || fileConfig.apiPort || DEFAULT_CONFIG.apiPort,
		logLevel:
			(process.env.IO_LOG_LEVEL as IOConfig['logLevel']) ||
			fileConfig.logLevel ||
			DEFAULT_CONFIG.logLevel,
		defaultModel: process.env.IO_MODEL || fileConfig.defaultModel || DEFAULT_CONFIG.defaultModel,
		maxInstancesPerSquad: fileConfig.maxInstancesPerSquad || DEFAULT_CONFIG.maxInstancesPerSquad,
		dataDir,
		pricing: {
			refreshIntervalHours:
				fileConfig.pricing?.refreshIntervalHours || DEFAULT_CONFIG.pricing.refreshIntervalHours,
		},
	};
}
