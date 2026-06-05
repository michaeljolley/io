export type MessageRole = "user" | "assistant" | "system";

export interface Message {
	id: string;
	conversationId: string;
	role: MessageRole;
	content: string;
	model: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	createdAt: string;
}

export interface Conversation {
	id: string;
	title: string | null;
	source: "web" | "telegram" | "scheduler" | "internal";
	createdAt: string;
	updatedAt: string;
}

export interface StreamChunk {
	type: "text" | "tool_call" | "tool_result" | "error" | "done";
	content: string;
	conversationId?: string;
	messageId?: string;
}
