import { getCurrentToken } from "@/lib/api";
import { EVENT_NAMES, type StreamChunk } from "@io/shared";
import { useEffect, useRef, useState } from "react";

const MAX_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const DEFAULT_CHANNELS = ["chat", "inbox", "activity"];

type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface WsMessage {
	type: string;
	channel?: string;
	payload?: unknown;
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
	onDelta?: (chunk: string) => void;
	onEvent?: (msg: WsMessage) => void;
	onError?: (content: string) => void;
}

function toRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function normalizeIncomingMessage(raw: string): WsMessage | null {
	const parsed = JSON.parse(raw) as { type?: string; channel?: string; payload?: unknown };
	if (typeof parsed.type !== "string") {
		return null;
	}

	const message: WsMessage = {
		type: parsed.type,
		channel: parsed.channel,
		payload: parsed.payload,
	};
	const payload = toRecord(parsed.payload);

	if (parsed.type === EVENT_NAMES.CHAT_STREAM_CHUNK) {
		const chunk = parsed.payload as StreamChunk;
		message.content = chunk.content;
	}

	if (parsed.type === EVENT_NAMES.NOTIFICATION && payload) {
		message.notification = [payload.title, payload.body]
			.filter((value): value is string => typeof value === "string" && value.length > 0)
			.join(" — ");
	}

	if (payload && parsed.type !== "connected") {
		message.event = {
			id: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
			type: parsed.type,
			timestamp:
				typeof payload.timestamp === "string"
					? payload.timestamp
					: typeof payload.createdAt === "string"
						? payload.createdAt
						: new Date().toISOString(),
			squadId: typeof payload.squadId === "string" ? payload.squadId : undefined,
			instanceId: typeof payload.instanceId === "string" ? payload.instanceId : undefined,
			agentRole: typeof payload.agentRole === "string" ? payload.agentRole : undefined,
			model: typeof payload.model === "string" ? payload.model : undefined,
			data: parsed.payload,
		};
	}

	return message;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
	const [connected, setConnected] = useState(false);
	const [connectionId, setConnectionId] = useState<string | null>(null);
	const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
	const wsRef = useRef<WebSocket | null>(null);
	const optionsRef = useRef(options);
	const retryCountRef = useRef(0);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shouldReconnectRef = useRef(true);
	const disconnectLoggedRef = useRef(false);
	optionsRef.current = options;

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		let wsUrl = `${protocol}//${window.location.host}/ws`;
		const token = getCurrentToken();
		if (token) {
			wsUrl += `?token=${encodeURIComponent(token)}`;
		}

		const connect = () => {
			if (!shouldReconnectRef.current) {
				return;
			}

			setConnectionState(retryCountRef.current > 0 ? "reconnecting" : "connecting");
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				const didReconnect = retryCountRef.current > 0 || disconnectLoggedRef.current;
				retryCountRef.current = 0;
				disconnectLoggedRef.current = false;
				setConnected(true);
				setConnectionState("connected");
				ws.send(JSON.stringify({ type: "subscribe", channels: DEFAULT_CHANNELS }));
				if (didReconnect) {
					console.info("WebSocket reconnected");
				}
			};

			ws.onmessage = (event) => {
				try {
					const message = normalizeIncomingMessage(event.data);
					if (!message) {
						return;
					}

					if (message.type === "connected") {
						setConnectionId(null);
						optionsRef.current.onEvent?.(message);
						return;
					}

					if (message.type === EVENT_NAMES.CHAT_STREAM_CHUNK) {
						optionsRef.current.onDelta?.(message.content ?? "");
					}

					if (message.type === "error") {
						const payload = toRecord(message.payload);
						optionsRef.current.onError?.(
							typeof payload?.message === "string" ? payload.message : "Unknown error",
						);
						return;
					}

					optionsRef.current.onEvent?.(message);
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
					console.warn("WebSocket disconnected; attempting to reconnect");
				}

				if (retryCountRef.current >= MAX_RETRIES) {
					setConnectionState("disconnected");
					return;
				}

				const delay = Math.min(
					BASE_RETRY_DELAY_MS * 2 ** retryCountRef.current,
					MAX_RETRY_DELAY_MS,
				);
				retryCountRef.current += 1;
				setConnectionState("reconnecting");
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
			wsRef.current?.close();
		};
	}, []);

	return { connected, connectionId, connectionState };
}
