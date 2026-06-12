import type { CopilotSession } from "@github/copilot-sdk";
import { addAgentEvent } from "../store/agent-events.js";

const MAX_ARGS_LENGTH = 500;
const MAX_RESULT_LENGTH = 1000;
const MAX_REASONING_LENGTH = 2000;

interface CaptureOptions {
	taskId: string;
	agentName: string;
	agentRole: string;
	model?: string;
	/** Called once with the first assistant.intent text (used to set task title). */
	onFirstIntent?: (intent: string) => void;
}

/**
 * Subscribe to granular session events (tool calls, reasoning, intent)
 * and persist them as agent_events for the timeline.
 *
 * Returns an unsubscribe function to call when the session ends.
 */
export function captureSessionEvents(
	session: CopilotSession,
	options: CaptureOptions,
): () => void {
	const { taskId, agentName, agentRole, model, onFirstIntent } = options;
	const basePayload = { agent: agentName, role: agentRole, model };

	// Track tool names by callId so we can label tool_result events
	const toolCallNames = new Map<string, string>();
	let intentFired = false;

	const unsubReasoning = session.on("assistant.reasoning", (event: any) => {
		const content: string = event.data?.content ?? "";
		if (!content.trim()) return;
		addAgentEvent(taskId, "thought", content.slice(0, 200), {
			...basePayload,
			content: content.slice(0, MAX_REASONING_LENGTH),
		});
	});

	const unsubIntent = session.on("assistant.intent", (event: any) => {
		const intent: string = event.data?.intent ?? "";
		if (!intent.trim()) return;
		if (!intentFired && onFirstIntent) {
			intentFired = true;
			onFirstIntent(intent);
		}
		addAgentEvent(taskId, "decision", intent, {
			...basePayload,
			intent,
		});
	});

	const unsubToolStart = session.on("tool.execution_start", (event: any) => {
		const toolName: string = event.data?.toolName ?? "unknown";
		const toolCallId: string = event.data?.toolCallId ?? "";
		const args = event.data?.arguments;

		toolCallNames.set(toolCallId, toolName);

		const argsStr = args ? JSON.stringify(args).slice(0, MAX_ARGS_LENGTH) : "";
		addAgentEvent(taskId, "tool_call", toolName, {
			...basePayload,
			toolCallId,
			toolName,
			arguments: argsStr,
		});
	});

	const unsubToolComplete = session.on(
		"tool.execution_complete",
		(event: any) => {
			const toolCallId: string = event.data?.toolCallId ?? "";
			const success: boolean = event.data?.success ?? false;
			const resultContent: string = event.data?.result?.content ?? "";
			const toolName = toolCallNames.get(toolCallId) ?? "unknown";

			toolCallNames.delete(toolCallId);

			const summary = success ? `${toolName} ✓` : `${toolName} ✗`;

			addAgentEvent(taskId, "tool_result", summary, {
				...basePayload,
				toolCallId,
				toolName,
				success,
				result: resultContent.slice(0, MAX_RESULT_LENGTH),
			});
		},
	);

	return () => {
		unsubReasoning();
		unsubIntent();
		unsubToolStart();
		unsubToolComplete();
	};
}
