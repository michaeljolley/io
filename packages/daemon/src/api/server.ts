import { createServer } from 'node:http';
import express from 'express';
import { type WebSocket, WebSocketServer } from 'ws';
import type { IOConfig } from '../config.js';
import { sendMessage } from '../copilot/orchestrator.js';
import { createChildLogger } from '../logging/logger.js';
import { healthRouter } from './routes/health.js';
import { usageRouter } from './routes/usage.js';

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

	// Routes
	app.use('/api', healthRouter());
	app.use('/api', usageRouter());

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

	const server = createServer(app);

	// WebSocket server for streaming
	const wss = new WebSocketServer({ server, path: '/ws' });

	wss.on('connection', (ws) => {
		const connectionId = crypto.randomUUID();
		wsClients.set(connectionId, ws);
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
