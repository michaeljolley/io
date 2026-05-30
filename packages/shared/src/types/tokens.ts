export interface TokenUsage {
	id: number;
	squadId?: string;
	instanceId?: string;
	agentRole?: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd?: number;
	timestamp: Date;
}

export interface ModelPricing {
	model: string;
	inputCostPer1m: number;
	outputCostPer1m: number;
	tier?: 'fast' | 'standard' | 'reasoning';
	lastUpdated: Date;
}
