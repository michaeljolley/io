import { pushNotification } from "@/components/NotificationPanel";
import { api, getCurrentToken } from "@/lib/api";
import { EVENT_NAMES } from "@io/shared";
import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { type WsMessage, useWebSocket } from "./use-websocket";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: string;
	attachmentName?: string;
	toolCall?: {
		name: string;
		status: "running" | "done" | "error";
		result?: string;
	};
	attachments?: string[] | null;
}

interface ChatContextValue {
	messages: ChatMessage[];
	streaming: string;
	isStreaming: boolean;
	isThinking: boolean;
	connected: boolean;
	sendChatMessage: (content: string) => Promise<void>;
	stopStreaming: () => void;
	addUserMessage: (msg: ChatMessage) => void;
	uploadAttachment: (file: File, messageId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streaming, setStreaming] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [isThinking, setIsThinking] = useState(false);
	const conversationIdRef = useRef<string | null>(null);

	const handleDelta = useCallback((chunk: string) => {
		setIsThinking(false);
		setIsStreaming(true);
		setStreaming((previous) => previous + chunk);
	}, []);

	const handleEvent = useCallback(
		(msg: WsMessage) => {
			if (msg.type === EVENT_NAMES.CHAT_STREAM_END) {
				setIsThinking(false);
				setIsStreaming(false);
				setMessages((prev) => {
					if (!streaming) {
						return prev;
					}
					return [
						...prev,
						{
							id: crypto.randomUUID(),
							role: "assistant",
							content: streaming,
							timestamp: new Date().toISOString(),
						},
					];
				});
				setStreaming("");
				return;
			}

			if (msg.notification) {
				pushNotification({
					id: msg.event?.id ?? crypto.randomUUID(),
					message: msg.notification,
					timestamp: msg.event?.timestamp ?? new Date().toISOString(),
					eventType: msg.event?.type ?? "unknown",
				});
			}
		},
		[streaming],
	);

	const handleError = useCallback(() => {
		setIsThinking(false);
		setIsStreaming(false);
		setStreaming("");
	}, []);

	const { connected } = useWebSocket({
		onDelta: handleDelta,
		onEvent: handleEvent,
		onError: handleError,
	});

	const sendChatMessage = useCallback(async (content: string) => {
		setIsThinking(true);
		setIsStreaming(false);
		setStreaming("");
		try {
			const response = await api.post<{ conversationId: string; messageId: string }>("/chat", {
				message: content,
				conversationId: conversationIdRef.current ?? undefined,
				source: "web",
			});
			conversationIdRef.current = response.conversationId;
		} catch (error) {
			setIsThinking(false);
			throw error;
		}
	}, []);

	const stopStreaming = useCallback(() => {
		if (streaming) {
			// Commit current streamed content as a message
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: streaming,
					timestamp: new Date().toISOString(),
				},
			]);
		}
		setIsStreaming(false);
		setIsThinking(false);
		setStreaming("");
	}, [streaming]);

	const addUserMessage = useCallback((msg: ChatMessage) => {
		setMessages((prev) => [...prev, msg]);
	}, []);

	const uploadAttachment = useCallback(async (file: File, messageId: string) => {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("messageId", messageId);

		const token = getCurrentToken();
		const res = await fetch("/api/attachments", {
			method: "POST",
			body: formData,
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		});

		if (!res.ok) {
			throw new Error("Failed to upload attachment");
		}
	}, []);

	return (
		<ChatContext.Provider
			value={{
				messages,
				streaming,
				isStreaming,
				isThinking,
				connected,
				sendChatMessage,
				stopStreaming,
				addUserMessage,
				uploadAttachment,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChat(): ChatContextValue {
	const ctx = useContext(ChatContext);
	if (!ctx) {
		throw new Error("useChat must be used within a ChatProvider");
	}
	return ctx;
}
