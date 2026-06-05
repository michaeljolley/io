import {
	type CopilotSession,
	type ExternalToolRequestedEvent,
	type Tool,
	type ToolResultObject,
	approveAll,
} from "@github/copilot-sdk";

import { getCopilotClient } from "./client.js";

const SEND_MESSAGE_TIMEOUT_MS = 120_000;

export interface UsageData {
	model: string;
	inputTokens: number;
	outputTokens: number;
}

export interface ToolDefinition<TArgs = unknown> extends Tool<TArgs> {}

export interface SessionOptions {
	model: string;
	systemPrompt: string;
	tools?: ToolDefinition[];
	onUsage?: (usage: UsageData) => void;
}

export interface ToolCall {
	requestId: string;
	sessionId: string;
	toolCallId: string;
	toolName: string;
	arguments?: Record<string, unknown>;
	traceparent?: string;
	tracestate?: string;
	workingDirectory?: string;
}

export interface SendMessageResult {
	text: string;
	usage: UsageData;
	toolCalls: ToolCall[];
}

export interface ToolExecutionResult {
	requestId: string;
	toolCallId: string;
	success: boolean;
	error?: string;
}

export type ToolExecutor =
	| ((
			toolCall: ToolCall,
	  ) => Promise<string | ToolResultObject | Record<string, unknown> | null | undefined>)
	| ((
			toolCall: ToolCall,
	  ) => string | ToolResultObject | Record<string, unknown> | null | undefined);

const sessionOptionsBySession = new WeakMap<CopilotSession, SessionOptions>();
const sessionQueueBySession = new WeakMap<CopilotSession, Promise<unknown>>();

function normalizeSessionOptions(options: SessionOptions): SessionOptions {
	const model = options.model.trim();
	const systemPrompt = options.systemPrompt.trim();

	if (model.length === 0) {
		throw new Error("SessionOptions.model must be a non-empty string.");
	}

	if (systemPrompt.length === 0) {
		throw new Error("SessionOptions.systemPrompt must be a non-empty string.");
	}

	return {
		...options,
		model,
		systemPrompt,
		tools: options.tools ?? [],
	};
}

function toToolCall(data: ExternalToolRequestedEvent["data"]): ToolCall {
	return {
		requestId: data.requestId,
		sessionId: data.sessionId,
		toolCallId: data.toolCallId,
		toolName: data.toolName,
		arguments: data.arguments,
		traceparent: data.traceparent,
		tracestate: data.tracestate,
		workingDirectory: data.workingDirectory,
	};
}

function normalizeToolResult(
	result: string | ToolResultObject | Record<string, unknown> | null | undefined,
): string | ToolResultObject {
	if (typeof result === "string") {
		return result;
	}

	if (result !== null && result !== undefined && "textResultForLlm" in result) {
		return result as ToolResultObject;
	}

	if (result === null || result === undefined) {
		return "";
	}

	try {
		return JSON.stringify(result, null, 2);
	} catch {
		return String(result);
	}
}

function getUsageAccumulator(model: string): UsageData {
	return {
		model,
		inputTokens: 0,
		outputTokens: 0,
	};
}

async function sendMessageInternal(
	session: CopilotSession,
	message: string,
	onChunk?: (chunk: string) => void,
): Promise<SendMessageResult> {
	const options = sessionOptionsBySession.get(session);

	if (options === undefined) {
		throw new Error("Unknown Copilot session. Use createSession() to create managed sessions.");
	}

	const prompt = message.trim();
	if (prompt.length === 0) {
		throw new Error("Message must be a non-empty string.");
	}

	let streamedText = "";
	let finalText = "";
	const toolCalls: ToolCall[] = [];
	const usage = getUsageAccumulator(options.model);

	const unsubscribeMessageDelta = session.on("assistant.message_delta", (event) => {
		if (event.agentId !== undefined) {
			return;
		}

		streamedText += event.data.deltaContent;
		onChunk?.(event.data.deltaContent);
	});

	const unsubscribeMessage = session.on("assistant.message", (event) => {
		if (event.agentId !== undefined) {
			return;
		}

		finalText = event.data.content;
		usage.model = event.data.model ?? usage.model;
	});

	const unsubscribeUsage = session.on("assistant.usage", (event) => {
		if (event.agentId !== undefined || event.data.parentToolCallId !== undefined) {
			return;
		}

		usage.model = event.data.model;
		usage.inputTokens += event.data.inputTokens ?? 0;
		usage.outputTokens += event.data.outputTokens ?? 0;
	});

	const unsubscribeToolRequested = session.on("external_tool.requested", (event) => {
		if (event.agentId !== undefined) {
			return;
		}

		toolCalls.push(toToolCall(event.data));
	});

	try {
		const response = await session.sendAndWait({ prompt }, SEND_MESSAGE_TIMEOUT_MS);

		if (response !== undefined) {
			finalText = response.data.content;
			usage.model = response.data.model ?? usage.model;

			if (usage.outputTokens === 0 && response.data.outputTokens !== undefined) {
				usage.outputTokens = response.data.outputTokens;
			}
		}

		const result: SendMessageResult = {
			text: finalText || streamedText,
			usage,
			toolCalls,
		};

		options.onUsage?.(result.usage);
		return result;
	} finally {
		unsubscribeMessageDelta();
		unsubscribeMessage();
		unsubscribeUsage();
		unsubscribeToolRequested();
	}
}

export async function createSession(options: SessionOptions): Promise<CopilotSession> {
	const normalizedOptions = normalizeSessionOptions(options);
	const client = await getCopilotClient();
	const tools = normalizedOptions.tools ?? [];

	const session = await client.createSession({
		clientName: "io-daemon",
		model: normalizedOptions.model,
		streaming: true,
		tools,
		availableTools: tools.map((tool) => tool.name),
		systemMessage: {
			mode: "replace",
			content: normalizedOptions.systemPrompt,
		},
		onPermissionRequest: approveAll,
		enableConfigDiscovery: false,
		skipCustomInstructions: true,
		enableSkills: false,
		enableSessionStore: false,
		enableHostGitOperations: false,
		skipEmbeddingRetrieval: true,
	});

	sessionOptionsBySession.set(session, normalizedOptions);
	sessionQueueBySession.set(session, Promise.resolve());
	return session;
}

export async function sendMessage(
	session: CopilotSession,
	message: string,
	onChunk?: (chunk: string) => void,
): Promise<SendMessageResult> {
	const previousOperation = sessionQueueBySession.get(session) ?? Promise.resolve();
	const operation = previousOperation
		.catch(() => undefined)
		.then(() => sendMessageInternal(session, message, onChunk));

	sessionQueueBySession.set(
		session,
		operation.then(
			() => undefined,
			() => undefined,
		),
	);

	return operation;
}

export async function handleToolCalls(
	session: CopilotSession,
	toolCalls: ToolCall[],
	executor: ToolExecutor,
): Promise<ToolExecutionResult[]> {
	return Promise.all(
		toolCalls.map(async (toolCall) => {
			try {
				const result = normalizeToolResult(await executor(toolCall));
				const handled = await session.rpc.tools.handlePendingToolCall({
					requestId: toolCall.requestId,
					result,
				});

				if (!handled.success) {
					throw new Error(`Copilot runtime rejected tool result for ${toolCall.toolName}.`);
				}

				return {
					requestId: toolCall.requestId,
					toolCallId: toolCall.toolCallId,
					success: true,
				} satisfies ToolExecutionResult;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const handled = await session.rpc.tools.handlePendingToolCall({
					requestId: toolCall.requestId,
					error: message,
				});

				return {
					requestId: toolCall.requestId,
					toolCallId: toolCall.toolCallId,
					success: handled.success,
					error: message,
				} satisfies ToolExecutionResult;
			}
		}),
	);
}
