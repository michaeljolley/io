import assert from "node:assert/strict";
import test from "node:test";
import { attachFocusOnOpen, type EventTargetLike } from "./focusOnAnimation";

type Handler = () => void;

test("focuses target when container emits animationend/transitionend", () => {
  const handlers: Record<string, Handler[]> = {};
  const container: EventTargetLike = {
    addEventListener: (ev: string, handler: Handler) => {
      handlers[ev] = handlers[ev] || [];
      handlers[ev].push(handler);
    },
    removeEventListener: (ev: string, handler: Handler) => {
      handlers[ev] = (handlers[ev] || []).filter((h) => h !== handler);
    },
  };

  let focused = 0;
  const target = {
    focus: () => {
      focused++;
    },
  };
  const cleanup = attachFocusOnOpen(container, target);

  // simulate animationend
  handlers.animationend?.forEach((h) => {
    h();
  });
  assert.equal(focused, 1);

  cleanup();
});

type GlobalWithTimers = {
  requestAnimationFrame: (cb: FrameRequestCallback) => number;
  setTimeout: (cb: (...args: unknown[]) => void, ms?: number) => number;
};

test("fallback focuses target via raf+timeout when no animation event fires", () => {
  // stub requestAnimationFrame and setTimeout to run synchronously in the test
  const g = globalThis as unknown as GlobalWithTimers;
  const originalRAF = g.requestAnimationFrame;
  const originalSetTimeout = g.setTimeout;

  g.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  };
  g.setTimeout = (cb: (...args: unknown[]) => void, _ms?: number) => {
    cb();
    return 2;
  };

  try {
    let focused = 0;
    const target = {
      focus: () => {
        focused++;
      },
    };
    const cleanup = attachFocusOnOpen(null, target);

    // our stubs run synchronously, so focus should have been called
    assert.equal(focused, 1);

    cleanup();
  } finally {
    g.requestAnimationFrame = originalRAF;
    g.setTimeout = originalSetTimeout;
  }
});
