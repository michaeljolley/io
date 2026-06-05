import type { ChatRequest } from "@io/shared";
import { Router } from "express";

import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import { deleteConversation, getConversation, listConversations } from "../../store/index.js";

const router = Router();
let orchestrator: Orchestrator | null = null;

export function setChatOrchestrator(value: Orchestrator): void {
	orchestrator = value;
}

router.post("/api/chat", async (req, res) => {
	try {
		if (!orchestrator) {
			res.status(503).json({ error: "Orchestrator is not initialized" });
			return;
		}

		const body = req.body as ChatRequest | undefined;
		const message = body?.message?.trim();
		const source = body?.source ?? "web";

		if (!message) {
			res.status(400).json({ error: "message is required" });
			return;
		}

		const result = await orchestrator.processMessage(message, body?.conversationId, source);
		res.status(200).json({
			conversationId: result.conversationId,
			messageId: result.assistantMessage.id,
			userMessage: result.userMessage,
			assistantMessage: result.assistantMessage,
		});
	} catch (error) {
		const statusCode = error instanceof Error && /not found/iu.test(error.message) ? 404 : 500;
		res.status(statusCode).json({
			error: "Failed to process chat message",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/conversations", async (req, res) => {
	try {
		const limit = parsePositiveInteger(req.query.limit, 50);
		const offset = parseNonNegativeInteger(req.query.offset, 0);
		const conversations = await listConversations(limit, offset);

		res.status(200).json({
			data: conversations,
			limit,
			offset,
		});
	} catch (error) {
		res.status(500).json({
			error: "Failed to list conversations",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/conversations/:id", async (req, res) => {
	try {
		const conversation = await getConversation(req.params.id);

		if (!conversation) {
			res.status(404).json({ error: "Conversation not found" });
			return;
		}

		res.status(200).json(conversation);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch conversation",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/api/conversations/:id", async (req, res) => {
	try {
		const deleted = await deleteConversation(req.params.id);

		if (!deleted) {
			res.status(404).json({ error: "Conversation not found" });
			return;
		}

		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to delete conversation",
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

export { router as chatRouter };
