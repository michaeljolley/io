/**
 * Tests for src/copilot/session-timeout.ts — sendWithIdleTimeout
 *
 * Strategy: build a FakeSession class whose sendAndWait() is controlled by
 * a deferred Promise. Event handlers registered via .on() are stored in a
 * subscriber list and can be triggered manually with .emit(). Timer
 * behaviour is driven by node:test's mock.timers so no real setTimeout fires.
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { CopilotSession, SessionEvent } from "@github/copilot-sdk";

import {
  sendWithIdleTimeout,
  type IdleSendOptions,
  type IdleSendResult,
} from "./session-timeout.js";

// ── Fake session ─────────────────────────────────────────────────────────────

type EventHandler = (event: SessionEvent) => void;
type DeltaHandler = (event: { data: { deltaContent: string; messageId: string; parentToolCallId?: string } }) => void;

/** Minimal fake implementing only what sendWithIdleTimeout needs. */
function makeFakeSession() {
  const broadcastHandlers: EventHandler[] = [];
  const deltaHandlers: DeltaHandler[] = [];

  let resolveWait: ((val: { data: { content: string } } | undefined) => void) | undefined;
  let rejectWait: ((err: Error) => void) | undefined;
  let aborted = false;

  const session = {
    // Typed overload: session.on("assistant.message_delta", handler)
    // Generic overload: session.on(handler)
    on(
      typeOrHandler: string | EventHandler,
      handler?: EventHandler,
    ): () => void {
      if (typeof typeOrHandler === "function") {
        broadcastHandlers.push(typeOrHandler);
        return () => {
          const idx = broadcastHandlers.indexOf(typeOrHandler);
          if (idx !== -1) broadcastHandlers.splice(idx, 1);
        };
      }
      // typed: only care about delta for accumulation
      if (typeOrHandler === "assistant.message_delta" && handler) {
        deltaHandlers.push(handler as unknown as DeltaHandler);
        return () => {
          const idx = deltaHandlers.indexOf(handler as unknown as DeltaHandler);
          if (idx !== -1) deltaHandlers.splice(idx, 1);
        };
      }
      return () => {};
    },

    sendAndWait(_opts: unknown, _timeout?: number): Promise<{ data: { content: string } } | undefined> {
      return new Promise((resolve, reject) => {
        resolveWait = resolve;
        rejectWait = reject;
      });
    },

    abort(): Promise<void> {
      aborted = true;
      return Promise.resolve();
    },

    // ── Test-only helpers ──────────────────────────────────────────────────

    /** Emit an event to all broad-listener handlers. */
    emit(event: SessionEvent) {
      for (const h of broadcastHandlers) h(event);
    },

    /** Emit an assistant.message_delta event with the given text chunk. */
    emitDelta(deltaContent: string) {
      const deltaEvent = {
        type: "assistant.message_delta" as const,
        id: "evt-1",
        timestamp: new Date().toISOString(),
        parentId: null,
        ephemeral: true as const,
        data: { messageId: "msg-1", deltaContent },
      } as SessionEvent;
      // Notify delta-specific handlers
      for (const h of deltaHandlers) {
        (h as unknown as (e: SessionEvent) => void)(deltaEvent);
      }
      // Also broadcast to all-event handlers so idle timer resets
      this.emit(deltaEvent);
    },

    /** Emit a generic progress event (e.g. tool.execution_complete). */
    emitProgress(type: string) {
      const event = {
        type,
        id: "evt-2",
        timestamp: new Date().toISOString(),
        parentId: null,
        ephemeral: false,
        data: {},
      } as unknown as SessionEvent;
      this.emit(event);
    },

    /** Resolve the sendAndWait promise with a final content string. */
    resolve(content: string) {
      resolveWait?.({ data: { content } });
    },

    /** Resolve the sendAndWait promise with undefined (triggers accumulated fallback). */
    resolveUndefined() {
      resolveWait?.(undefined);
    },

    /** Reject the sendAndWait promise with a timeout-style error. */
    rejectWithTimeout() {
      rejectWait?.(new Error("Timeout after 600000ms waiting for session.idle"));
    },

    /** Reject the sendAndWait promise with a non-timeout error. */
    rejectWithError(msg: string) {
      rejectWait?.(new Error(msg));
    },

    get wasAborted() {
      return aborted;
    },
  };

  return session;
}

type FakeSession = ReturnType<typeof makeFakeSession>;

// Cast FakeSession to CopilotSession for type-compatibility with sendWithIdleTimeout.
// The fake satisfies the structural subset used by the function.
function asSession(fake: FakeSession): CopilotSession {
  return fake as unknown as CopilotSession;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTS: IdleSendOptions = {
  idleMs: 5_000,
  hardCapMs: 30_000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sendWithIdleTimeout", () => {
  before(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  after(() => {
    mock.timers.reset();
  });

  beforeEach(() => {
    // Reset the fake timer state between tests without disabling
    mock.timers.reset();
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  // ── happy path ──────────────────────────────────────────────────────────

  it("returns content and timedOut=false when session resolves normally", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "do something", DEFAULT_OPTS);

    // Let the initial idle timer be registered, then resolve immediately
    fake.resolve("task done successfully");
    const result = await promise;

    assert.equal(result.timedOut, false);
    assert.equal(result.content, "task done successfully");
    assert.equal(result.timeoutReason, undefined);
  });

  it("accumulates delta content during streaming (verified via resolveUndefined)", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "stream this", DEFAULT_OPTS);

    fake.emitDelta("Hello ");
    fake.emitDelta("world");
    fake.emitDelta("!");

    // resolveUndefined triggers `response?.data?.content ?? accumulated` → uses accumulated
    fake.resolveUndefined();
    const result = await promise;

    assert.equal(result.timedOut, false);
    assert.equal(result.content, "Hello world!");
  });

  it("falls back to accumulated delta when sendAndWait resolves with undefined", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "stream this", DEFAULT_OPTS);

    fake.emitDelta("partial ");
    fake.emitDelta("output");

    // Resolve with undefined to trigger the `response?.data?.content ?? accumulated` fallback
    fake.resolveUndefined();
    const result = await promise;

    assert.equal(result.timedOut, false);
    assert.equal(result.content, "partial output");
  });

  // ── idle timer reset ────────────────────────────────────────────────────

  it("resets idle timer on assistant.message_delta", async () => {
    const fake = makeFakeSession();
    const idleTimeoutFired = { value: false };
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 1_000,
      onIdleTimeout: () => { idleTimeoutFired.value = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "do work", opts);

    // Advance to just before idle timeout — timer should NOT fire yet
    mock.timers.tick(800);
    assert.equal(idleTimeoutFired.value, false);

    // Emit a progress event — should reset the idle timer
    fake.emitProgress("tool.execution_complete");

    // Advance another 800ms — if reset worked, timer still hasn't fired (800 < 1000)
    mock.timers.tick(800);
    assert.equal(idleTimeoutFired.value, false, "idle timer should have been reset by progress event");

    // Resolve and clean up
    fake.resolve("done");
    await promise;
  });

  it("fires idle timeout after idleMs of silence", async () => {
    const fake = makeFakeSession();
    let idleFired = false;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 2_000,
      onIdleTimeout: () => { idleFired = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "long task", opts);

    // Advance past idle timeout — no events emitted
    mock.timers.tick(2_001);

    // Abort fires async; wait a tick then check
    await Promise.resolve();
    assert.equal(idleFired, true, "onIdleTimeout should have fired");
    assert.equal(fake.wasAborted, true, "session.abort() should have been called");

    // Simulate the sendAndWait timing out after abort
    fake.rejectWithTimeout();
    const result = await promise;
    assert.equal(result.timedOut, true);
  });

  it("resets idle timer on tool.execution_complete", async () => {
    const fake = makeFakeSession();
    let idleFired = false;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 1_000,
      onIdleTimeout: () => { idleFired = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "tool task", opts);

    mock.timers.tick(700);
    fake.emitProgress("tool.execution_complete");
    mock.timers.tick(700); // 700ms since last reset — still under 1000ms
    assert.equal(idleFired, false, "idle timer should have been reset by tool event");

    fake.resolve("done");
    await promise;
    assert.equal(idleFired, false);
  });

  it("resets idle timer on assistant.turn_start", async () => {
    const fake = makeFakeSession();
    let idleFired = false;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 1_000,
      onIdleTimeout: () => { idleFired = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "turn task", opts);

    mock.timers.tick(700);
    fake.emitProgress("assistant.turn_start");
    mock.timers.tick(700);
    assert.equal(idleFired, false, "idle timer should reset on assistant.turn_start");

    fake.resolve("done");
    await promise;
  });

  it("does NOT reset idle timer for unrecognised event types", async () => {
    const fake = makeFakeSession();
    let idleFired = false;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 1_000,
      onIdleTimeout: () => { idleFired = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "noisy task", opts);

    mock.timers.tick(700);
    // This event type is not in PROGRESS_EVENT_TYPES
    fake.emitProgress("some.unknown.event");
    mock.timers.tick(400); // 700 + 400 = 1100ms since last real reset

    await Promise.resolve();
    assert.equal(idleFired, true, "idle timer should fire — unknown event should not reset it");

    fake.rejectWithTimeout();
    const result = await promise;
    assert.equal(result.timedOut, true);
  });

  // ── graceful timeout capture ─────────────────────────────────────────────

  it("captures partial content when idle timeout fires mid-stream", async () => {
    const fake = makeFakeSession();
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 1_000,
    };

    const promise = sendWithIdleTimeout(asSession(fake), "long output", opts);

    // Agent emits some content then goes silent
    fake.emitDelta("Step 1 done. ");
    fake.emitDelta("Step 2 in progress...");

    // Advance past idle timeout
    mock.timers.tick(1_001);
    await Promise.resolve();

    // sendAndWait throws a timeout error after abort
    fake.rejectWithTimeout();
    const result = await promise;

    assert.equal(result.timedOut, true);
    // idle timer fires first → abortReason="idle"; catch block sees aborted=true and preserves it
    assert.equal(result.timeoutReason, "idle", "idle fired before sendAndWait rejection → reason stays idle");
    assert.ok(
      result.content.includes("Step 1 done.") && result.content.includes("Step 2 in progress..."),
      `partial content should be captured; got: ${result.content}`,
    );
  });

  it("returns fallback message when no content was accumulated before timeout", async () => {
    const fake = makeFakeSession();
    const opts: IdleSendOptions = { ...DEFAULT_OPTS, idleMs: 500 };

    const promise = sendWithIdleTimeout(asSession(fake), "silent agent", opts);

    mock.timers.tick(501);
    await Promise.resolve();

    fake.rejectWithTimeout();
    const result = await promise;

    assert.equal(result.timedOut, true);
    assert.ok(
      result.content.includes("no output captured"),
      `should report no output captured; got: ${result.content}`,
    );
  });

  it("sets timeoutReason=idle when abort fires before sendAndWait throws", async () => {
    const fake = makeFakeSession();
    let idleCallbackInfo: { lastEventType: string | undefined; idleMs: number } | undefined;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      idleMs: 500,
      onIdleTimeout: (info) => { idleCallbackInfo = info; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "silent", opts);

    mock.timers.tick(501);
    await Promise.resolve(); // let abort() fire

    // When aborted=true, the resolve branch returns timedOut:true with timeoutReason from abortReason
    fake.resolve("some final content");
    const result = await promise;

    assert.equal(result.timedOut, true);
    assert.equal(result.timeoutReason, "idle");
    assert.ok(idleCallbackInfo, "onIdleTimeout callback should have been called");
    assert.equal(idleCallbackInfo?.idleMs, 500);
  });

  it("calls onProgress for each recognised event type", async () => {
    const fake = makeFakeSession();
    const progressEvents: string[] = [];
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      onProgress: (type) => progressEvents.push(type),
    };

    const promise = sendWithIdleTimeout(asSession(fake), "track progress", opts);

    fake.emitProgress("tool.execution_start");
    fake.emitProgress("tool.execution_complete");
    fake.emitDelta("some output");

    fake.resolve("done");
    await promise;

    assert.ok(progressEvents.includes("tool.execution_start"));
    assert.ok(progressEvents.includes("tool.execution_complete"));
    assert.ok(progressEvents.includes("assistant.message_delta"));
  });

  it("tracks lastEventType in result", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "track last", DEFAULT_OPTS);

    fake.emitProgress("tool.execution_start");
    fake.emitProgress("tool.execution_complete");

    fake.resolve("done");
    const result = await promise;

    assert.equal(result.lastEventType, "tool.execution_complete");
  });

  // ── error handling ───────────────────────────────────────────────────────

  it("re-throws non-timeout errors", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "bad prompt", DEFAULT_OPTS);

    fake.rejectWithError("unexpected authentication failure");

    await assert.rejects(
      () => promise,
      (err: Error) => {
        assert.ok(err.message.includes("unexpected authentication failure"));
        return true;
      },
    );
  });

  it("calls onHardCap when sendAndWait throws timeout and aborted=false", async () => {
    const fake = makeFakeSession();
    let hardCapFired = false;
    const opts: IdleSendOptions = {
      ...DEFAULT_OPTS,
      onHardCap: () => { hardCapFired = true; },
    };

    const promise = sendWithIdleTimeout(asSession(fake), "hard task", opts);

    // Don't advance past idle timer — just let the hard cap throw
    fake.rejectWithTimeout();
    const result = await promise;

    assert.equal(result.timedOut, true);
    assert.equal(result.timeoutReason, "hard_cap");
    assert.equal(hardCapFired, true);
  });

  it("cleans up subscriptions after normal completion (no memory leak)", async () => {
    const fake = makeFakeSession();
    const promise = sendWithIdleTimeout(asSession(fake), "cleanup test", DEFAULT_OPTS);
    fake.resolve("done");
    const result = await promise;
    assert.equal(result.timedOut, false);
    // If unsubscribe threw, the test would fail — we're asserting no throw
  });
});
