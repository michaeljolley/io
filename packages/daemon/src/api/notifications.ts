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
 * Initialize the notification system — subscribes to event bus and broadcasts to clients.
 */
export function initNotifications(): void {
	const log = logger();

	getEventBus().onAny((event: IOEvent) => {
		const payload = JSON.stringify({
			type: 'event',
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
