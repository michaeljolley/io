import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Router } from 'express';
import { loadConfig } from '../../config.js';

export function configRouter(): Router {
	const router = Router();

	function getConfigPath(): string {
		const dataDir = process.env.IO_DATA_DIR ?? join(homedir(), '.io');
		const resolved = dataDir.startsWith('~') ? join(homedir(), dataDir.slice(1)) : dataDir;
		return join(resolved, 'config.json');
	}

	/**
	 * GET /api/config
	 * Return current config with sensitive fields redacted.
	 */
	router.get('/config', (_req, res) => {
		try {
			const config = loadConfig();
			// Redact sensitive fields
			const redacted = {
				apiPort: config.apiPort,
				logLevel: config.logLevel,
				defaultModel: config.defaultModel,
				maxInstancesPerSquad: config.maxInstancesPerSquad,
				dataDir: config.dataDir,
					timezone: config.timezone,
					pricing: config.pricing,
					telegram: {
							botToken: config.telegram.botToken,
						allowedChatIds: config.telegram.allowedChatIds,
					},
					supabase: {
						projectUrl: config.supabase.projectUrl,
						anonKey: config.supabase.anonKey,
							jwtSecret: config.supabase.jwtSecret,
					},
					byok: config.byok
						? { type: config.byok.type, baseUrl: config.byok.baseUrl, configured: true }
						: null,
				};
			res.json({ config: redacted });
		} catch (err) {
			res.status(500).json({ error: 'Failed to load config' });
		}
	});

	/**
	 * PATCH /api/config
	 * Merge partial config into config.json on disk.
	 * Does NOT accept dataDir changes (immutable).
	 * Body: partial config object
	 */
	router.patch('/config', (req, res) => {
		try {
			const updates = req.body as Record<string, any>;

			if (!updates || typeof updates !== 'object') {
				res.status(400).json({ error: 'Body must be a JSON object' });
				return;
			}

			// Disallow changing dataDir (would break running daemon)
			delete updates.dataDir;

			const configPath = getConfigPath();
			let existing: Record<string, any> = {};
			if (existsSync(configPath)) {
				existing = JSON.parse(readFileSync(configPath, 'utf-8'));
			}

			// Deep merge one level (telegram, pricing)
			const merged = { ...existing };
			for (const [key, value] of Object.entries(updates)) {
				if (
					value !== null &&
					typeof value === 'object' &&
					!Array.isArray(value) &&
					typeof merged[key] === 'object'
				) {
					merged[key] = { ...merged[key], ...value };
				} else {
					merged[key] = value;
				}
			}

			writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');

			// Reload and return redacted
			const config = loadConfig();
			res.json({
				config: {
					apiPort: config.apiPort,
					logLevel: config.logLevel,
					defaultModel: config.defaultModel,
					maxInstancesPerSquad: config.maxInstancesPerSquad,
					dataDir: config.dataDir,
					pricing: config.pricing,
					telegram: {
							botToken: config.telegram.botToken,
						allowedChatIds: config.telegram.allowedChatIds,
					},
					supabase: {
						projectUrl: config.supabase.projectUrl,
						anonKey: config.supabase.anonKey,
							jwtSecret: config.supabase.jwtSecret,
					},
					byok: config.byok
						? { type: config.byok.type, baseUrl: config.byok.baseUrl, configured: true }
						: null,
				},
			});
		} catch (err) {
			res.status(500).json({ error: 'Failed to update config' });
		}
	});

	return router;
}
