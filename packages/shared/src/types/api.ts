export interface ApiMessage {
	content: string;
	source?: 'tui' | 'telegram' | 'web';
	attachmentIds?: string[];
}

export interface ApiSquadResponse {
	id: string;
	name: string;
	projectPath: string;
	status: string;
	autonomyTier: string;
	memberCount: number;
	activeInstances: number;
}

export interface ApiUsageResponse {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalEstimatedCost: number;
	breakdown: {
		model: string;
		inputTokens: number;
		outputTokens: number;
		estimatedCost: number;
	}[];
}

export interface ApiHealthResponse {
	status: 'healthy' | 'degraded' | 'unhealthy';
	uptime: number;
	copilotConnected: boolean;
	activeSquads: number;
	activeInstances: number;
}
