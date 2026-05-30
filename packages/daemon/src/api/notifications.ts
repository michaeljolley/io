import type { IOEvent } from '@io/shared';
import type { WebSocket } from 'ws';
import { createChildLogger } from '../logging/logger.js';
import { getEventBus } from '../squad/event-bus.js';

const logger = () => createChildLogger('notifications');

// Connected clients that want event notifications
const subscribers = new Map<string, WebSocket>();

/**
 * Register a WebSocket client for event notifications.
 */
export function subscribeClient(connectionId: string, ws: WebSocket): void {
	subscribers.set(connectionId, ws);
}

/**
 * Unregister a WebSocket client.
 */
export function unsubscribeClient(connectionId: string): void {
	subscribers.delete(connectionId);
}

/**
 * Render an event to a human-readable notification string.
 */
function renderNotification(event: IOEvent): string {
	switch (event.type) {
		case 'squad:created':
			return `🆕 Squad "${event.squadName}" has been hired`;
		case 'squad:disbanded':
			return `🗑️ Squad "${event.squadName}" has been disbanded`;
		case 'squad:member_added':
			return `👋 New member added to "${event.squadName}"`;
		case 'squad:member_retired':
			return `👤 Member retired from "${event.squadName}"`;
		case 'instance:created':
			return '🚀 New work instance started';
		case 'instance:meeting_started':
			return '🤝 Round-table meeting in progress';
		case 'instance:meeting_complete':
			return '✅ Meeting complete — consensus reached';
		case 'instance:work_started':
			return '⚡ Squad is working on tasks';
		case 'instance:pr_created':
			return `📬 PR created: ${(event.data as { prUrl?: string })?.prUrl ?? ''}`;
		case 'instance:complete':
			return '🎉 Work instance completed successfully';
		case 'instance:failed':
			return '❌ Work instance failed';
		case 'agent:task_started':
			return `🔧 ${event.agentRole} started a task`;
		case 'agent:task_completed':
			return `✔️ ${event.agentRole} completed a task`;
		case 'agent:error':
			return `⚠️ ${event.agentRole} encountered an error`;
		case 'agent:permission_denied':
			return `🚫 ${event.agentRole} was denied permission`;
		case 'agent:tool_call':
			return `🛠️ ${event.agentRole} used a tool`;
		case 'meeting:contribution':
			return `💬 ${event.agentRole}: "${event.content.slice(0, 80)}"`;
		case 'meeting:consensus_reached':
			return '🤝 Consensus reached in meeting';
		case 'meeting:veto':
			return `🛑 ${event.agentRole} vetoed the proposal`;
		case 'inbox:new':
			return event.kind === 'question'
				? `❓ Squad has a question: "${event.title}"`
				: `📋 Squad delivered: "${event.title}"`;
		case 'inbox:resolved':
			return `✅ Inbox item resolved: "${event.title}"`;
		case 'schedule:fired':
			return `⏰ Schedule fired: "${(event.data as { name?: string })?.name ?? 'unknown'}"`;
		case 'schedule:completed':
			return `✅ Schedule completed: "${(event.data as { name?: string })?.name ?? 'unknown'}"`;
		case 'schedule:failed':
			return `❌ Schedule failed: "${(event.data as { name?: string })?.name ?? 'unknown'}"`;
		default:
			return `📣 Event: ${(event as { type: string }).type}`;
	}
}

/**
 * Initialize the notification system — subscribes to event bus and broadcasts to clients.
 */
export function initNotifications(): void {
	const log = logger();

	getEventBus().onAny((event: IOEvent) => {
		const notification = renderNotification(event);
		const payload = JSON.stringify({
			type: 'event',
			notification,
			event: {
				id: event.id,
				type: event.type,
				timestamp: event.timestamp.toISOString(),
				squadId: event.squadId,
				instanceId: event.instanceId,
				data: 'data' in event ? event.data : undefined,
			},
		});

		let delivered = 0;
		for (const [connId, ws] of subscribers) {
			if (ws.readyState === ws.OPEN) {
				ws.send(payload);
				delivered++;
			} else {
				subscribers.delete(connId);
			}
		}

		if (delivered > 0) {
			log.debug({ eventType: event.type, delivered }, 'Event broadcast');
		}
	});

	log.info('Notification system initialized');
}
