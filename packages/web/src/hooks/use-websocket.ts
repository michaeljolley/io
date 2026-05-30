import { getCurrentToken } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export type WsMessageType = 'connected' | 'delta' | 'message' | 'event' | 'error';

export interface WsMessage {
	type: WsMessageType;
	connectionId?: string;
	content?: string;
	notification?: string;
	event?: {
		id: string;
		type: string;
		timestamp: string;
		squadId?: string;
		instanceId?: string;
		data?: unknown;
	};
}

interface UseWebSocketOptions {
	onDelta?: (accumulated: string) => void;
	onMessage?: (content: string) => void;
	onEvent?: (msg: WsMessage) => void;
	onError?: (content: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
	const [connected, setConnected] = useState(false);
	const [connectionId, setConnectionId] = useState<string | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		let wsUrl = `${protocol}//${window.location.host}/ws`;

		// Attach token as query param for server-side verification
		const token = getCurrentToken();
		if (token) {
			wsUrl += `?token=${encodeURIComponent(token)}`;
		}

		let ws: WebSocket;
		let reconnectTimeout: ReturnType<typeof setTimeout>;

		function connect() {
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				setConnected(true);
			};

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data) as WsMessage;
					switch (msg.type) {
						case 'connected':
							setConnectionId(msg.connectionId ?? null);
							break;
						case 'delta':
							optionsRef.current.onDelta?.(msg.content ?? '');
							break;
						case 'message':
							optionsRef.current.onMessage?.(msg.content ?? '');
							break;
						case 'event':
							optionsRef.current.onEvent?.(msg);
							break;
						case 'error':
							optionsRef.current.onError?.(msg.content ?? 'Unknown error');
							break;
					}
				} catch {
					// ignore parse errors
				}
			};

			ws.onclose = () => {
				setConnected(false);
				setConnectionId(null);
				reconnectTimeout = setTimeout(connect, 3000);
			};

			ws.onerror = () => {
				ws.close();
			};

			wsRef.current = ws;
		}

		connect();

		return () => {
			clearTimeout(reconnectTimeout);
			ws?.close();
		};
	}, []);

	const sendMessage = useCallback((content: string, source = 'web') => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: 'message', content, source }));
		}
	}, []);

	return { connected, connectionId, sendMessage };
}
