import { EVENT_NAMES, type EventPayloads } from "@io/shared";

import { eventBus as defaultEventBus } from "../event-bus.js";
import { createInboxItem, listInboxItems } from "../store/index.js";

let initialized = false;

export function initNotifications(eventBus = defaultEventBus): void {
	if (initialized) {
		return;
	}

	initialized = true;

	eventBus.on(EVENT_NAMES.INBOX_NEW_ITEM, ({ item }) => {
		eventBus.emit(EVENT_NAMES.NOTIFICATION, {
			title: item.title,
			body: item.content,
			channel: "inbox",
		});
	});

	eventBus.on(EVENT_NAMES.QA_ESCALATED, (payload) => {
		void createNotificationItemIfMissing(
			eventBus,
			payload,
			"escalation",
			"QA escalated objective",
			payload.reason,
		);
	});

	eventBus.on(EVENT_NAMES.OBJECTIVE_COMPLETED, (payload) => {
		void createNotificationItemIfMissing(
			eventBus,
			payload,
			"deliverable",
			"Objective completed",
			payload.objective.description,
		);
	});

	eventBus.on(EVENT_NAMES.OBJECTIVE_FAILED, (payload) => {
		void createNotificationItemIfMissing(
			eventBus,
			payload,
			"escalation",
			"Objective failed",
			payload.reason,
		);
	});

	// Telegram delivery hooks will be added here when the transport is available.
}

async function createNotificationItemIfMissing(
	eventBus: typeof defaultEventBus,
	payload:
		| EventPayloads[typeof EVENT_NAMES.QA_ESCALATED]
		| EventPayloads[typeof EVENT_NAMES.OBJECTIVE_COMPLETED]
		| EventPayloads[typeof EVENT_NAMES.OBJECTIVE_FAILED],
	type: "deliverable" | "escalation",
	title: string,
	content: string,
): Promise<void> {
	const objective = "objective" in payload ? payload.objective : null;
	const objectiveId = objective?.id ?? ("objectiveId" in payload ? payload.objectiveId : null);
	const squadId = objective?.squadId ?? null;
	const existingItems = await listInboxItems(undefined, 500, 0);
	const existing = existingItems.find(
		(item) =>
			item.objectiveId === objectiveId &&
			item.type === type &&
			item.title === title &&
			item.content === content &&
			item.status !== "resolved",
	);

	if (existing) {
		eventBus.emit(EVENT_NAMES.NOTIFICATION, {
			title: existing.title,
			body: existing.content,
			channel: "inbox",
		});
		return;
	}

	const item = await createInboxItem({
		squadId,
		objectiveId,
		type,
		title,
		content,
	});

	eventBus.emit(EVENT_NAMES.INBOX_NEW_ITEM, { item });
}
