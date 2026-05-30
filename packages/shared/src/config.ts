import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from './constants.js';

export interface IOConfig {
	apiPort: number;
	logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
	defaultModel: string;
	maxInstancesPerSquad: number;
	dataDir: string;
	pricing: {
		refreshIntervalHours: number;
	};
	telegram: {
		botToken: string | null;
		allowedChatIds: number[];
	};
	supabase: {
		projectUrl: string | null;
		anonKey: string | null;
		jwtSecret: string | null;
	};
}

function resolveDataDir(dir: string): string {
	if (dir.startsWith('~')) {
		return join(homedir(), dir.slice(1));
	}
	return dir;
}

/**
 * Load IO configuration. Priority: env vars > config file > defaults.
 * Config file location: ~/.io/config.json (or IO_DATA_DIR/config.json).
 */
export function loadConfig(): IOConfig {
	const dataDir = resolveDataDir(process.env.IO_DATA_DIR ?? DEFAULT_CONFIG.dataDir);
	const configPath = join(dataDir, 'config.json');

	let fileConfig: Record<string, any> = {};
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
		telegram: {
			botToken: process.env.TELEGRAM_BOT_TOKEN || fileConfig.telegram?.botToken || null,
			allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS
				? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map((id) =>
						Number.parseInt(id.trim(), 10),
					)
				: fileConfig.telegram?.allowedChatIds || [],
		},
		supabase: {
			projectUrl: process.env.IO_SUPABASE_URL || fileConfig.supabase?.projectUrl || null,
			anonKey: process.env.IO_SUPABASE_ANON_KEY || fileConfig.supabase?.anonKey || null,
			jwtSecret: process.env.IO_SUPABASE_JWT_SECRET || fileConfig.supabase?.jwtSecret || null,
		},
	};
}
