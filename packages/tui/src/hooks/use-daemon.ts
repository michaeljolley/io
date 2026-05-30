import { useCallback, useEffect, useRef, useState } from 'react';
import { type DaemonClient, type DaemonMessage, createDaemonClient } from '../client.js';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	streaming?: boolean;
}

interface UseDaemonResult {
	messages: ChatMessage[];
	send: (content: string) => void;
	connected: boolean;
	error: string | null;
}

export function useDaemon(port: number): UseDaemonResult {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const clientRef = useRef<DaemonClient | null>(null);
	const streamingIdRef = useRef<string | null>(null);

	useEffect(() => {
		const client = createDaemonClient(port);
		clientRef.current = client;

		const unsub = client.onMessage((msg: DaemonMessage) => {
			switch (msg.type) {
				case 'connected':
					setConnected(true);
					setError(null);
					break;

				case 'delta': {
					const sid = streamingIdRef.current;
					if (sid) {
						setMessages((prev) =>
							prev.map((m) => (m.id === sid ? { ...m, content: msg.content ?? '' } : m)),
						);
					} else {
						const newId = crypto.randomUUID();
						streamingIdRef.current = newId;
						setMessages((prev) => [
							...prev,
							{ id: newId, role: 'assistant', content: msg.content ?? '', streaming: true },
						]);
					}
					break;
				}

				case 'message': {
					const sid = streamingIdRef.current;
					if (sid) {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === sid ? { ...m, content: msg.content ?? '', streaming: false } : m,
							),
						);
						streamingIdRef.current = null;
					} else {
						setMessages((prev) => [
							...prev,
							{ id: crypto.randomUUID(), role: 'assistant', content: msg.content ?? '' },
						]);
					}
					break;
				}

				case 'error':
					setError(msg.content ?? 'Unknown error');
					break;
			}
		});

		client.connect().catch((err) => {
			setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
		});

		return () => {
			unsub();
			client.disconnect();
		};
	}, [port]);

	const send = useCallback((content: string) => {
		if (!clientRef.current?.isConnected()) return;
		setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
		clientRef.current.send(content);
	}, []);

	return { messages, send, connected, error };
}
