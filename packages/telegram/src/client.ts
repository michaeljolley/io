import WebSocket from 'ws';

export interface DaemonMessage {
	type: 'connected' | 'delta' | 'message' | 'error' | 'event';
	content?: string;
	connectionId?: string;
	event?: unknown;
}

export type MessageHandler = (msg: DaemonMessage) => void;

export interface DaemonClient {
	connect(): Promise<string>;
	disconnect(): void;
	send(content: string): void;
	onMessage(handler: MessageHandler): () => void;
	isConnected(): boolean;
}

export function createDaemonClient(port: number): DaemonClient {
	let ws: WebSocket | null = null;
	let connectionId = '';
	const handlers = new Set<MessageHandler>();
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function dispatch(msg: DaemonMessage) {
		for (const handler of handlers) {
			try {
				handler(msg);
			} catch {
				// ignore handler errors
			}
		}
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (!connected) {
				doConnect().catch(() => {
					scheduleReconnect();
				});
			}
		}, 5000);
	}

	function doConnect(): Promise<string> {
		return new Promise((resolve, reject) => {
			const url = `ws://127.0.0.1:${port}/ws`;
			ws = new WebSocket(url);

			const timeout = setTimeout(() => {
				reject(new Error('Connection timeout'));
				ws?.close();
			}, 5000);

			ws.on('open', () => {
				connected = true;
			});

			ws.on('message', (data) => {
				try {
					const msg = JSON.parse(data.toString()) as DaemonMessage;
					if (msg.type === 'connected' && msg.connectionId) {
						connectionId = msg.connectionId;
						clearTimeout(timeout);
						resolve(connectionId);
					}
					dispatch(msg);
				} catch {
					// ignore parse errors
				}
			});

			ws.on('close', () => {
				connected = false;
				scheduleReconnect();
			});

			ws.on('error', (err) => {
				connected = false;
				clearTimeout(timeout);
				reject(err);
				scheduleReconnect();
			});
		});
	}

	return {
		connect() {
			return doConnect();
		},

		disconnect() {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			ws?.close();
			ws = null;
			connected = false;
		},

		send(content: string) {
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			ws.send(JSON.stringify({ type: 'message', content, source: 'telegram' }));
		},

		onMessage(handler: MessageHandler): () => void {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},

		isConnected() {
			return connected;
		},
	};
}
