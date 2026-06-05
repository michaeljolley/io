import type { Conversation, Message } from "./conversation.js";
import type { Objective, PrMode, Squad, SquadMember, Task } from "./squad.js";
import type { Activity, AppSettings, InboxItem, Schedule, TokenUsage, WikiPage } from "./store.js";

// Chat API
export interface ChatRequest {
	message: string;
	conversationId?: string;
	source?: "web" | "telegram";
}

export interface ChatResponse {
	conversationId: string;
	messageId: string;
}

// Squad API
export interface HireSquadRequest {
	repoUrl: string;
}

export interface HireSquadResponse {
	squad: Squad;
	members: SquadMember[];
}

export interface UpdateSquadConfigRequest {
	prMode?: PrMode;
	mcpServers?: string[];
}

export interface CreateObjectiveRequest {
	description: string;
}

// Inbox API
export interface InboxReplyRequest {
	reply: string;
}

// Schedule API
export interface CreateScheduleRequest {
	name: string;
	cronExpression: string;
	prompt: string;
	enabled?: boolean;
}

export interface UpdateScheduleRequest {
	name?: string;
	cronExpression?: string;
	prompt?: string;
	enabled?: boolean;
}

// Wiki API
export interface CreateWikiPageRequest {
	path: string;
	title: string;
	content: string;
	tags?: string[];
}

export interface UpdateWikiPageRequest {
	title?: string;
	content?: string;
	tags?: string[];
}

export interface WikiSearchRequest {
	query: string;
	limit?: number;
}

// Skills API
export interface InstallSkillRequest {
	url?: string;
	source?: string;
	slug?: string;
}

// Usage API
export interface UsageQueryParams {
	startDate?: string;
	endDate?: string;
	squadId?: string;
	agentId?: string;
	model?: string;
}

export interface UsageSummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCost: number;
	bySquad: Array<{
		squadId: string;
		squadName: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
	}>;
	byAgent: Array<{
		agentId: string;
		agentName: string;
		squadId: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
	}>;
	byModel: Array<{
		model: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
	}>;
	daily: Array<{
		date: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
	}>;
}

// Activity API
export interface ActivityQueryParams {
	squadId?: string;
	limit?: number;
	offset?: number;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	limit: number;
	offset: number;
}

// WebSocket messages
export type WsClientMessage =
	| { type: "subscribe"; channels: string[] }
	| { type: "unsubscribe"; channels: string[] }
	| { type: "chat"; payload: ChatRequest };

export interface WsServerMessage {
	type: string;
	payload: unknown;
}

// Re-exports for convenience
export type {
	Squad,
	SquadMember,
	Objective,
	Task,
	Conversation,
	Message,
	InboxItem,
	Schedule,
	Activity,
	TokenUsage,
	WikiPage,
	AppSettings,
};
