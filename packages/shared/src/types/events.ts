export type SquadEventType =
	| 'squad:created'
	| 'squad:disbanded'
	| 'squad:member_added'
	| 'squad:member_retired';

export type AgentEventType =
	| 'agent:task_started'
	| 'agent:task_completed'
	| 'agent:tool_call'
	| 'agent:error'
	| 'agent:permission_denied';

export type InstanceEventType =
	| 'instance:created'
	| 'instance:meeting_started'
	| 'instance:meeting_complete'
	| 'instance:work_started'
	| 'instance:pr_created'
	| 'instance:complete'
	| 'instance:failed';

export type MeetingEventType =
	| 'meeting:contribution'
	| 'meeting:consensus_reached'
	| 'meeting:veto';

export type InboxEventType = 'inbox:new' | 'inbox:resolved';

export type ScheduleEventType = 'schedule:fired' | 'schedule:completed' | 'schedule:failed';

export interface BaseEvent {
	id: string;
	timestamp: Date;
	squadId?: string;
	instanceId?: string;
}

export interface SquadEvent extends BaseEvent {
	type: SquadEventType;
	squadName: string;
	data?: Record<string, unknown>;
}

export interface AgentEvent extends BaseEvent {
	type: AgentEventType;
	agentRole: string;
	model?: string;
	data?: Record<string, unknown>;
}

export interface InstanceEvent extends BaseEvent {
	type: InstanceEventType;
	data?: Record<string, unknown>;
}

export interface MeetingEvent extends BaseEvent {
	type: MeetingEventType;
	agentRole: string;
	content: string;
}

export interface InboxEvent extends BaseEvent {
	type: InboxEventType;
	kind: 'deliverable' | 'question';
	title: string;
	entryId: string;
}

export interface ScheduleEvent extends BaseEvent {
	type: ScheduleEventType;
	data?: Record<string, unknown>;
}

export type IOEvent =
	| SquadEvent
	| AgentEvent
	| InstanceEvent
	| MeetingEvent
	| InboxEvent
	| ScheduleEvent;
