export type InboxItemType = "deliverable" | "blocking_question" | "escalation";
export type InboxItemStatus = "pending" | "read" | "replied" | "resolved";

export interface InboxItem {
	id: string;
	squadId: string | null;
	objectiveId: string | null;
	type: InboxItemType;
	title: string;
	content: string;
	status: InboxItemStatus;
	reply: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Schedule {
	id: string;
	name: string;
	cronExpression: string;
	prompt: string;
	enabled: boolean;
	lastRunAt: string | null;
	nextRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Activity {
	id: string;
	squadId: string | null;
	objectiveId: string | null;
	event: string;
	description: string;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}

export interface TokenUsage {
	id: string;
	squadId: string | null;
	agentId: string | null;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
	createdAt: string;
}

export interface WikiPage {
	path: string;
	title: string;
	content: string;
	tags: string[];
	updatedAt: string;
}

export interface AppSettings {
	port: number;
	logLevel: string;
	defaultModel: string;
	telegramToken: string | null;
	telegramUserId: string | null;
	supabaseUrl: string | null;
	supabaseAnonKey: string | null;
	sessionResetThreshold: number;
}
