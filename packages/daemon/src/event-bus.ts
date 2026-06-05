import { EventEmitter } from "node:events";

import type { EventHandler, EventName, EventPayloads } from "@io/shared";

class TypedEventBus extends EventEmitter {
	emit<E extends EventName>(event: E, payload: EventPayloads[E]): boolean {
		return super.emit(event, payload);
	}

	on<E extends EventName>(event: E, handler: EventHandler<E>): this {
		return super.on(event, handler as (payload: EventPayloads[E]) => void);
	}

	off<E extends EventName>(event: E, handler: EventHandler<E>): this {
		return super.off(event, handler as (payload: EventPayloads[E]) => void);
	}

	once<E extends EventName>(event: E, handler: EventHandler<E>): this {
		return super.once(event, handler as (payload: EventPayloads[E]) => void);
	}
}

export const eventBus = new TypedEventBus();
