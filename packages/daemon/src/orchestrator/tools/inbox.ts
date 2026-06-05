import { EVENT_NAMES, type InboxItemStatus } from "@io/shared";
import { z } from "zod";

import type { ToolDefinition } from "../../copilot/session.js";
import { eventBus } from "../../event-bus.js";
import { asNumber, getDatabase } from "../../store/db.js";
import { listInboxItems, replyToItem } from "../../store/index.js";

import type { OrchestratorToolExecutor } from "./squad.js";

const inboxReplySchema = z.object({
	itemId: z.string().trim().min(1),
	reply: z.string().trim().min(1),
});

const inboxListSchema = z.object({
	status: z
		.enum(["pending", "read", "replied", "resolved"] satisfies [
			InboxItemStatus,
			...InboxItemStatus[],
		])
		.optional(),
});

export const inboxToolDefinitions: ToolDefinition[] = [
	{
		name: "inbox_reply",
		description: "Reply to an inbox item.",
		parameters: inboxReplySchema,
		skipPermission: true,
	},
	{
		name: "inbox_list",
		description: "List inbox items, optionally filtered by status.",
		parameters: inboxListSchema,
		skipPermission: true,
	},
	{
		name: "check_inbox",
		description: "Count pending inbox items.",
		parameters: z.object({}),
		skipPermission: true,
	},
];

export const executeInboxToolCall: OrchestratorToolExecutor = async (toolName, rawArgs) => {
	switch (toolName) {
		case "inbox_reply": {
			const { itemId, reply } = inboxReplySchema.parse(rawArgs);
			const item = await replyToItem(itemId, reply);
			if (!item) {
				throw new Error(`Inbox item ${itemId} was not found.`);
			}
			eventBus.emit(EVENT_NAMES.INBOX_REPLIED, { itemId: item.id, reply });
			return { message: `Replied to inbox item ${item.id}.`, item };
		}
		case "inbox_list": {
			const { status } = inboxListSchema.parse(rawArgs);
			const items = await listInboxItems(status, 100, 0);
			return {
				message:
					items.length > 0
						? `Found ${items.length} inbox item(s).`
						: "Inbox is empty for that filter.",
				items,
			};
		}
		case "check_inbox": {
			const database = await getDatabase();
			const result = await database.execute(
				"SELECT COUNT(*) AS count FROM inbox WHERE status = 'pending'",
			);
			const count = result.rows[0] ? asNumber(result.rows[0].count) : 0;
			return { message: `There are ${count} pending inbox item(s).`, count };
		}
		default:
			throw new Error(`Unsupported inbox tool: ${toolName}`);
	}
};
