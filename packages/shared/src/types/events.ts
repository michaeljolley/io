import type { EVENT_NAMES } from "../constants.js";
import type { StreamChunk } from "./conversation.js";
import type { Objective, Squad, Task } from "./squad.js";
import type { InboxItem } from "./store.js";

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export interface EventPayloads {
	[EVENT_NAMES.SQUAD_CREATED]: { squad: Squad };
	[EVENT_NAMES.SQUAD_DELETED]: { squadId: string };
	[EVENT_NAMES.SQUAD_UPDATED]: { squad: Squad };
	[EVENT_NAMES.OBJECTIVE_STARTED]: { objective: Objective };
	[EVENT_NAMES.OBJECTIVE_COMPLETED]: { objective: Objective };
	[EVENT_NAMES.OBJECTIVE_FAILED]: { objective: Objective; reason: string };
	[EVENT_NAMES.TASK_STARTED]: { task: Task; agentName: string };
	[EVENT_NAMES.TASK_COMPLETED]: { task: Task; agentName: string };
	[EVENT_NAMES.TASK_FAILED]: { task: Task; agentName: string; reason: string };
	[EVENT_NAMES.AGENT_EXECUTING]: { squadId: string; agentId: string; taskId: string };
	[EVENT_NAMES.AGENT_COMPLETED]: { squadId: string; agentId: string; taskId: string };
	[EVENT_NAMES.REVIEW_STARTED]: { objectiveId: string };
	[EVENT_NAMES.REVIEW_COMPLETED]: { objectiveId: string; summary: string };
	[EVENT_NAMES.QA_APPROVED]: { objectiveId: string };
	[EVENT_NAMES.QA_REJECTED]: { objectiveId: string; reason: string; revisionCount: number };
	[EVENT_NAMES.QA_ESCALATED]: { objectiveId: string; reason: string };
	[EVENT_NAMES.PR_CREATED]: { objectiveId: string; prUrl: string };
	[EVENT_NAMES.PR_MERGED]: { objectiveId: string; prUrl: string };
	[EVENT_NAMES.INBOX_NEW_ITEM]: { item: InboxItem };
	[EVENT_NAMES.INBOX_REPLIED]: { itemId: string; reply: string };
	[EVENT_NAMES.CHAT_MESSAGE]: { conversationId: string; content: string };
	[EVENT_NAMES.CHAT_STREAM_CHUNK]: StreamChunk;
	[EVENT_NAMES.CHAT_STREAM_END]: { conversationId: string; messageId: string };
	[EVENT_NAMES.NOTIFICATION]: { title: string; body: string; channel: string };
}

export type EventHandler<E extends EventName> = (payload: EventPayloads[E]) => void;
