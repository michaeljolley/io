import { EVENT_NAMES, type InboxItemStatus, type InboxReplyRequest } from "@io/shared";
import { Router } from "express";

import { eventBus } from "../../event-bus.js";
import { getInboxItem, listInboxItems, markRead, replyToItem } from "../../store/index.js";

const router = Router();
const VALID_STATUSES = new Set<InboxItemStatus>(["pending", "read", "replied", "resolved"]);

router.get("/api/inbox", async (req, res) => {
	try {
		const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
		if (rawStatus && !VALID_STATUSES.has(rawStatus as InboxItemStatus)) {
			res.status(400).json({ error: "Invalid inbox status" });
			return;
		}

		const limit = parsePositiveInteger(req.query.limit, 50);
		const offset = parseNonNegativeInteger(req.query.offset, 0);
		const items = await listInboxItems(rawStatus as InboxItemStatus | undefined, limit, offset);
		res.status(200).json({ data: items, limit, offset });
	} catch (error) {
		res.status(500).json({
			error: "Failed to list inbox items",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/inbox/:id", async (req, res) => {
	try {
		const item = await getInboxItem(req.params.id);
		if (!item) {
			res.status(404).json({ error: "Inbox item not found" });
			return;
		}

		res.status(200).json(item);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch inbox item",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/inbox/:id/reply", async (req, res) => {
	try {
		const body = req.body as InboxReplyRequest | undefined;
		const reply = body?.reply?.trim();

		if (!reply) {
			res.status(400).json({ error: "reply is required" });
			return;
		}

		const item = await replyToItem(req.params.id, reply);
		if (!item) {
			res.status(404).json({ error: "Inbox item not found" });
			return;
		}

		eventBus.emit(EVENT_NAMES.INBOX_REPLIED, { itemId: item.id, reply: item.reply ?? reply });
		res.status(200).json(item);
	} catch (error) {
		res.status(500).json({
			error: "Failed to reply to inbox item",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/inbox/:id/read", async (req, res) => {
	try {
		const item = await markRead(req.params.id);
		if (!item) {
			res.status(404).json({ error: "Inbox item not found" });
			return;
		}

		res.status(200).json(item);
	} catch (error) {
		res.status(500).json({
			error: "Failed to mark inbox item as read",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

function parsePositiveInteger(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export { router as inboxRouter };
