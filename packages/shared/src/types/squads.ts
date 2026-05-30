export type AutonomyTier = 'low' | 'medium' | 'high';

export interface AutonomyConfig {
	canMergePrs: boolean;
	canCreateReleases: boolean;
	canCloseIssues: boolean;
	canSelfReview: boolean;
	requiresUserApprovalFor: string[];
}

export interface Squad {
	id: string;
	name: string;
	projectPath: string;
	repoUrl?: string;
	universe?: string;
	autonomyTier: AutonomyTier;
	autonomyConfig: AutonomyConfig;
	status: 'active' | 'paused' | 'disbanded';
	createdAt: Date;
}

export interface SquadMember {
	id: string;
	squadId: string;
	displayName: string;
	roleName: string;
	persona?: string;
	skillFilePath?: string;
	toolsAllowed: string[];
	isVetoMember: boolean;
	status: 'active' | 'retired';
	createdAt: Date;
}

export type InstanceStatus =
	| 'planning'
	| 'meeting'
	| 'working'
	| 'reviewing'
	| 'complete'
	| 'failed';

export interface SquadInstance {
	id: string;
	squadId: string;
	issueRef?: string;
	worktreePath?: string;
	branchName?: string;
	status: InstanceStatus;
	createdAt: Date;
	completedAt?: Date;
}
