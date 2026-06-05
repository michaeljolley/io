import type { PR_MODES } from "../constants.js";

export type PrMode = (typeof PR_MODES)[number];

export type SquadStatus = "active" | "inactive" | "executing";

export type MemberRole = "team-lead" | "qa" | string;

export interface SquadConfig {
	prMode: PrMode;
	mcpServers: string[];
	maxRevisions: number;
}

export interface Squad {
	id: string;
	name: string;
	repoUrl: string;
	repoOwner: string;
	repoName: string;
	status: SquadStatus;
	config: SquadConfig;
	createdAt: string;
	updatedAt: string;
}

export interface SquadMember {
	id: string;
	squadId: string;
	role: MemberRole;
	name: string;
	systemPrompt: string;
	model: string | null;
	createdAt: string;
}

export type TaskStatus = "pending" | "in_progress" | "done" | "failed" | "blocked";

export type ObjectiveStatus =
	| "pending"
	| "planning"
	| "executing"
	| "reviewing"
	| "qa"
	| "completed"
	| "failed"
	| "escalated";

export interface Objective {
	id: string;
	squadId: string;
	description: string;
	status: ObjectiveStatus;
	plan: string | null;
	revisionCount: number;
	branch: string | null;
	prUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Task {
	id: string;
	objectiveId: string;
	assigneeId: string | null;
	title: string;
	description: string;
	status: TaskStatus;
	result: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ExecutionInstance {
	id: string;
	objectiveId: string;
	squadId: string;
	status: "running" | "completed" | "failed" | "cancelled";
	startedAt: string;
	completedAt: string | null;
}
