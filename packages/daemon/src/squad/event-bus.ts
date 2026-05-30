import type { IOEvent } from '@io/shared';
import { createChildLogger } from '../logging/logger.js';

type EventHandler<T extends IOEvent = IOEvent> = (event: T) => void | Promise<void>;

/**
 * Typed pub/sub event bus with error-isolated handlers.
 * Handlers that throw are logged but don't crash the bus or other handlers.
 */
export class EventBus {
	private handlers = new Map<string, Set<EventHandler>>();
	private globalHandlers = new Set<EventHandler>();
	private logger = createChildLogger('event-bus');

	/** Subscribe to a specific event type */
	on<T extends IOEvent>(type: T['type'], handler: EventHandler<T>): () => void {
		if (!this.handlers.has(type)) {
			this.handlers.set(type, new Set());
		}
		const set = this.handlers.get(type)!;
		set.add(handler as EventHandler);
		return () => set.delete(handler as EventHandler);
	}

	/** Subscribe to all events */
	onAny(handler: EventHandler): () => void {
		this.globalHandlers.add(handler);
		return () => this.globalHandlers.delete(handler);
	}

	/** Emit an event to all matching handlers */
	async emit(event: IOEvent): Promise<void> {
		const typeHandlers = this.handlers.get(event.type) ?? new Set();
		const allHandlers = [...typeHandlers, ...this.globalHandlers];

		const results = await Promise.allSettled(
			allHandlers.map((handler) => {
				try {
					return Promise.resolve(handler(event));
				} catch (err) {
					return Promise.reject(err);
				}
			}),
		);

		for (const result of results) {
			if (result.status === 'rejected') {
				this.logger.error(
					{ err: result.reason, eventType: event.type },
					'Event handler threw an error',
				);
			}
		}
	}

	/** Remove all handlers */
	clear(): void {
		this.handlers.clear();
		this.globalHandlers.clear();
	}
}

// Singleton instance
let busInstance: EventBus | null = null;

export function getEventBus(): EventBus {
	if (!busInstance) {
		busInstance = new EventBus();
	}
	return busInstance;
}
