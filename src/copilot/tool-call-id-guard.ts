import type { CopilotSession } from "@github/copilot-sdk";
import { logWarn } from "../logging.js";

const DUPLICATE_TOOL_CALL_ID_PATTERN =
	/Duplicate item found with id (fc_call_[\w-]+)/i;

type SendOptions = Parameters<CopilotSession["sendAndWait"]>[0];
type SendResult = Awaited<ReturnType<CopilotSession["sendAndWait"]>>;

interface DuplicateToolCallEvent {
	eventId: string;
	toolCallId: string;
}

function getErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	return "";
}

function findDuplicateExternalToolCallEvent(
	events: Awaited<ReturnType<CopilotSession["getMessages"]>>,
): DuplicateToolCallEvent | undefined {
	const seen = new Set<string>();

	for (const event of events) {
		if (event.type !== "external_tool.requested") continue;
		const toolCallId = event.data?.toolCallId;
		if (!toolCallId) continue;
		if (seen.has(toolCallId)) {
			return {
				eventId: event.id,
				toolCallId,
			};
		}
		seen.add(toolCallId);
	}

	return undefined;
}

function getDuplicateToolCallIdFromError(err: unknown): string | undefined {
	const message = getErrorMessage(err);
	const match = DUPLICATE_TOOL_CALL_ID_PATTERN.exec(message);
	return match?.[1];
}

export async function truncateDuplicateToolCalls(
	session: CopilotSession,
	context: string,
): Promise<boolean> {
	const events = await session.getMessages();
	const duplicate = findDuplicateExternalToolCallEvent(events);
	if (!duplicate) return false;

	const result = await session.rpc.history.truncate({
		eventId: duplicate.eventId,
	});
	logWarn(
		"Detected duplicate tool call ID in session history; truncated tail",
		{
			context,
			sessionId: session.sessionId,
			toolCallId: duplicate.toolCallId,
			eventId: duplicate.eventId,
			eventsRemoved: result.eventsRemoved,
		},
	);
	return true;
}

export async function sendAndWaitWithoutDuplicateToolCallIds(
	session: CopilotSession,
	options: SendOptions,
	timeout: number,
	context: string,
): Promise<SendResult> {
	await truncateDuplicateToolCalls(session, `${context}:preflight`);

	try {
		return await session.sendAndWait(options, timeout);
	} catch (err) {
		const duplicateToolCallId = getDuplicateToolCallIdFromError(err);
		if (!duplicateToolCallId) throw err;

		logWarn(
			"Model API rejected duplicate tool call ID; attempting session-history repair",
			{
				context,
				sessionId: session.sessionId,
				toolCallId: duplicateToolCallId,
			},
		);

		const didTruncate = await truncateDuplicateToolCalls(
			session,
			`${context}:retry`,
		);
		if (!didTruncate) throw err;

		return session.sendAndWait(options, timeout);
	}
}
