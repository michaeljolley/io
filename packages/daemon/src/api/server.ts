import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { type WebSocket, WebSocketServer } from 'ws';
import type { IOConfig } from '../config.js';
import { sendMessage } from '../copilot/orchestrator.js';
import { createChildLogger } from '../logging/logger.js';
import { authMiddleware, verifyWsToken } from './middleware/auth.js';
import { initNotifications, subscribeClient, unsubscribeClient } from './notifications.js';
import { activityRouter } from './routes/activity.js';
import { attachmentsRouter } from './routes/attachments.js';
import { configRouter } from './routes/config.js';
import { conversationsRouter } from './routes/conversations.js';
import { healthRouter } from './routes/health.js';
import { inboxRouter } from './routes/inbox.js';
import { schedulesRouter } from './routes/schedules.js';
import { skillsRouter } from './routes/skills.js';
import { squadsRouter } from './routes/squads.js';
import { usageRouter } from './routes/usage.js';
import { wikiRouter } from './routes/wiki.js';

export interface ApiServer {
	start(): Promise<void>;
	stop(): Promise<void>;
}

// Connected WebSocket clients keyed by connection ID
const wsClients = new Map<string, WebSocket>();

export function createApiServer(config: IOConfig): ApiServer {
	const logger = createChildLogger('api');
	const app = express();
	app.use(express.json());

	// Auth middleware — verifies Supabase JWT if configured
	app.use('/api', authMiddleware(config));

	// Routes
	app.use('/api', healthRouter());
	app.use('/api', usageRouter());
	app.use('/api', squadsRouter());
	app.use('/api', activityRouter());
	app.use('/api', attachmentsRouter(config.dataDir));
	app.use('/api', inboxRouter());
	app.use('/api', schedulesRouter());
	app.use('/api', conversationsRouter());
	app.use('/api', configRouter());
	app.use('/api/wiki', wikiRouter);
	app.use('/api', skillsRouter);

	// POST /api/messages — send a message to the orchestrator
	app.post('/api/messages', async (req, res) => {
		const { content, source, connectionId } = req.body as {
			content?: string;
			source?: 'tui' | 'telegram' | 'web';
			connectionId?: string;
		};

		if (!content) {
			res.status(400).json({ error: 'content is required' });
			return;
		}

		const ws = connectionId ? wsClients.get(connectionId) : undefined;

		const onDelta = (accumulated: string, done: boolean) => {
			if (ws && ws.readyState === ws.OPEN) {
				ws.send(
					JSON.stringify({
						type: done ? 'message' : 'delta',
						content: accumulated,
					}),
				);
			}
		};

		try {
			const response = await sendMessage(content, source ?? 'web', onDelta);
			res.json({ status: 'ok', content: response });
		} catch (err) {
			logger.error({ err }, 'Error processing message');
			res.status(500).json({ error: 'Failed to process message' });
		}
	});

	// Serve web frontend static files (production build)
	const __dirname = fileURLToPath(new URL('.', import.meta.url));
	const webDistPath = resolve(__dirname, '../../../web/dist');
	if (existsSync(webDistPath)) {
		app.use(express.static(webDistPath));
		// SPA fallback: serve index.html for any non-API route
		app.get('*', (_req, res) => {
			res.sendFile(join(webDistPath, 'index.html'));
		});
		logger.info({ path: webDistPath }, 'Serving web frontend');
	}

	const server = createServer(app);

	// WebSocket server for streaming
	const wss = new WebSocketServer({ server, path: '/ws' });

	wss.on('connection', (ws, req) => {
		// Verify token from query string if auth is configured
		const url = new URL(req.url ?? '', `http://${req.headers.host}`);
		const token = url.searchParams.get('token');
		if (!verifyWsToken(config, token)) {
			ws.close(4001, 'Unauthorized');
			return;
		}
		const connectionId = crypto.randomUUID();
		wsClients.set(connectionId, ws);
		subscribeClient(connectionId, ws);
		logger.info({ connectionId }, 'WebSocket client connected');

		// Send the connection ID to the client
		ws.send(JSON.stringify({ type: 'connected', connectionId }));

		ws.on('message', (data) => {
			try {
				const parsed = JSON.parse(data.toString()) as {
					type?: string;
					content?: string;
					source?: string;
				};

				if (parsed.type === 'message' && parsed.content) {
					const source = (parsed.source as 'tui' | 'telegram' | 'web') ?? 'tui';

					const onDelta = (accumulated: string, done: boolean) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(
								JSON.stringify({
									type: done ? 'message' : 'delta',
									content: accumulated,
								}),
							);
						}
					};

					sendMessage(parsed.content, source, onDelta).catch((err) => {
						logger.error({ err }, 'Error processing WebSocket message');
						if (ws.readyState === ws.OPEN) {
							ws.send(JSON.stringify({ type: 'error', content: 'Failed to process message' }));
						}
					});
				}
			} catch (err) {
				logger.error({ err }, 'Failed to parse WebSocket message');
			}
		});

		ws.on('close', () => {
			wsClients.delete(connectionId);
			unsubscribeClient(connectionId);
			logger.info({ connectionId }, 'WebSocket client disconnected');
		});
	});

	return {
		async start() {
			return new Promise<void>((resolve) => {
				server.listen(config.apiPort, () => {
					logger.info({ port: config.apiPort }, 'API server listening');
					resolve();
				});
			});
		},

		async stop() {
			return new Promise<void>((resolve, reject) => {
				for (const ws of wsClients.values()) {
					ws.close();
				}
				wsClients.clear();
				wss.close();
				server.close((err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		},
	};
}
