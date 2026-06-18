import test from "node:test";
import assert from "node:assert/strict";
import {
	sendAndWaitWithoutDuplicateToolCallIds,
	truncateDuplicateToolCalls,
} from "./tool-call-id-guard.js";

type StubEvent = {
	id: string;
	type: string;
	data?: { toolCallId?: string };
};

function createSessionStub(events: StubEvent[]) {
	const calls = {
		truncate: [] as string[],
		sendAndWait: [] as { prompt: string }[],
	};

	const session = {
		sessionId: "session-1",
		async getMessages() {
			return events as any;
		},
		rpc: {
			history: {
				async truncate({ eventId }: { eventId: string }) {
					calls.truncate.push(eventId);
					return { eventsRemoved: 3 };
				},
			},
		},
		async sendAndWait(options: { prompt: string }) {
			calls.sendAndWait.push(options);
			return { data: { content: "ok" }, type: "assistant.message" } as any;
		},
	};

	return { session: session as any, calls };
}

test("truncateDuplicateToolCalls truncates at first duplicate external tool event", async () => {
	const { session, calls } = createSessionStub([
		{
			id: "e1",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_1" },
		},
		{ id: "e2", type: "assistant.message" },
		{
			id: "e3",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_1" },
		},
	]);

	const truncated = await truncateDuplicateToolCalls(session, "test");

	assert.equal(truncated, true);
	assert.deepEqual(calls.truncate, ["e3"]);
});

test("truncateDuplicateToolCalls does nothing when no duplicate exists", async () => {
	const { session, calls } = createSessionStub([
		{
			id: "e1",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_1" },
		},
		{
			id: "e2",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_2" },
		},
	]);

	const truncated = await truncateDuplicateToolCalls(session, "test");

	assert.equal(truncated, false);
	assert.deepEqual(calls.truncate, []);
});

test("sendAndWaitWithoutDuplicateToolCallIds retries once after duplicate-id API error", async () => {
	const events: StubEvent[] = [
		{
			id: "e1",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_1" },
		},
		{
			id: "e2",
			type: "external_tool.requested",
			data: { toolCallId: "fc_call_1" },
		},
	];
	const { session, calls } = createSessionStub(events);

	let attempts = 0;
	session.sendAndWait = async (options: { prompt: string }) => {
		calls.sendAndWait.push(options);
		attempts += 1;
		if (attempts === 1) {
			throw new Error(
				"CAPIError: 400 Duplicate item found with id fc_call_1. Remove duplicate items from your input and try again.",
			);
		}
		return { data: { content: "recovered" }, type: "assistant.message" };
	};

	const result = await sendAndWaitWithoutDuplicateToolCallIds(
		session,
		{ prompt: "hello" },
		1000,
		"test",
	);

	assert.equal(result?.data?.content, "recovered");
	assert.equal(calls.sendAndWait.length, 2);
	assert.deepEqual(calls.truncate, ["e2", "e2"]);
});
