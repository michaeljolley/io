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
	unreadInbox: number;
}

export function useDaemon(port: number): UseDaemonResult {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [unreadInbox, setUnreadInbox] = useState(0);
	const clientRef = useRef<DaemonClient | null>(null);
	const streamingIdRef = useRef<string | null>(null);

	// Poll unread inbox count
	useEffect(() => {
		if (!connected) return;

		const fetchCount = () => {
			fetch(`http://127.0.0.1:${port}/api/inbox/unread-count`)
				.then((res) => res.json())
				.then((data: unknown) => {
					const d = data as { count?: number };
					if (typeof d.count === 'number') setUnreadInbox(d.count);
				})
				.catch(() => {});
		};

		fetchCount();
		const interval = setInterval(fetchCount, 10_000);
		return () => clearInterval(interval);
	}, [connected, port]);

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

	return { messages, send, connected, error, unreadInbox };
}
