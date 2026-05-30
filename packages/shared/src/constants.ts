import type { AutonomyConfig } from './types/squads.js';

export const AUTONOMY_TIERS: Record<string, AutonomyConfig> = {
	low: {
		canMergePrs: false,
		canCreateReleases: false,
		canCloseIssues: false,
		canSelfReview: false,
		requiresUserApprovalFor: ['merge', 'release', 'close', 'review'],
	},
	medium: {
		canMergePrs: false,
		canCreateReleases: false,
		canCloseIssues: true,
		canSelfReview: true,
		requiresUserApprovalFor: ['merge', 'release'],
	},
	high: {
		canMergePrs: true,
		canCreateReleases: true,
		canCloseIssues: true,
		canSelfReview: true,
		requiresUserApprovalFor: [],
	},
};

export const DEFAULT_CONFIG = {
	apiPort: 7777,
	logLevel: 'info' as const,
	defaultModel: 'claude-opus-4.6',
	maxInstancesPerSquad: 3,
	dataDir: '~/.io',
	pricing: {
		refreshIntervalHours: 24,
	},
};
