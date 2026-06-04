import { getCurrentToken } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

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
		agentRole?: string;
		model?: string;
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
	const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
	const wsRef = useRef<WebSocket | null>(null);
	const optionsRef = useRef(options);
	const retryCountRef = useRef(0);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shouldReconnectRef = useRef(true);
	const disconnectLoggedRef = useRef(false);
	optionsRef.current = options;

	useEffect(() => {
		// Reset on (re)mount. React 18 StrictMode runs effects mount→cleanup→mount
		// in dev; the cleanup sets this to false, so without resetting here the
		// second invocation would bail in connect() and never establish the socket.
		shouldReconnectRef.current = true;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		let wsUrl = `${protocol}//${window.location.host}/ws`;

		// Attach token as query param for server-side verification
		const token = getCurrentToken();
		if (token) {
			wsUrl += `?token=${encodeURIComponent(token)}`;
		}

		const connect = () => {
			if (!shouldReconnectRef.current) {
				return;
			}

			setConnectionState(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				const didReconnect = retryCountRef.current > 0 || disconnectLoggedRef.current;
				retryCountRef.current = 0;
				disconnectLoggedRef.current = false;
				setConnected(true);
				setConnectionState('connected');
				if (didReconnect) {
					console.info('WebSocket reconnected');
				}
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
				wsRef.current = null;
				setConnected(false);
				setConnectionId(null);

				if (!shouldReconnectRef.current) {
					return;
				}

				if (!disconnectLoggedRef.current) {
					disconnectLoggedRef.current = true;
					console.warn('WebSocket disconnected; attempting to reconnect');
				}

				if (retryCountRef.current >= MAX_RETRIES) {
					setConnectionState('disconnected');
					return;
				}

				const delay = Math.min(
					BASE_RETRY_DELAY_MS * 2 ** retryCountRef.current,
					MAX_RETRY_DELAY_MS,
				);
				retryCountRef.current += 1;
				setConnectionState('reconnecting');
				reconnectTimeoutRef.current = setTimeout(connect, delay);
			};

			ws.onerror = () => {
				ws.close();
			};
		};

		connect();

		return () => {
			shouldReconnectRef.current = false;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			const ws = wsRef.current;
			if (!ws) {
				return;
			}
			// Detach handlers so teardown doesn't trigger the reconnect cascade.
			ws.onclose = null;
			ws.onerror = null;
			if (ws.readyState === WebSocket.CONNECTING) {
				// Chrome logs an error if you close() a socket mid-handshake.
				// Wait until it opens, then close cleanly.
				ws.onopen = () => ws.close();
			} else {
				ws.close();
			}
		};
	}, []);

	const sendMessage = useCallback((content: string, source = 'web') => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: 'message', content, source }));
		}
	}, []);

	return { connected, connectionId, connectionState, sendMessage };
}
