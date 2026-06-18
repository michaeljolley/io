import test from "node:test";
import assert from "node:assert/strict";
import { attachFocusOnOpen } from "./focusOnAnimation";

test("focuses target when container emits animationend/transitionend", () => {
  const handlers: Record<string, Function[]> = {};
  const container = {
    addEventListener: (ev: string, handler: Function) => {
      handlers[ev] = handlers[ev] || [];
      handlers[ev].push(handler);
    },
    removeEventListener: (ev: string, handler: Function) => {
      handlers[ev] = (handlers[ev] || []).filter((h) => h !== handler);
    },
  } as any;

  let focused = 0;
  const target = { focus: () => { focused++; } };
  const cleanup = attachFocusOnOpen(container, target);

  // simulate animationend
  handlers["animationend"]?.forEach((h) => h());
  assert.equal(focused, 1);

  cleanup();
});

test("fallback focuses target via raf+timeout when no animation event fires", () => {
  // stub requestAnimationFrame and setTimeout to run synchronously in the test
  const originalRAF = (globalThis as any).requestAnimationFrame;
  const originalSetTimeout = (globalThis as any).setTimeout;

  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1 as any; };
  (globalThis as any).setTimeout = (cb: (...args: any[]) => void, _ms?: number) => { cb(); return 2 as any; };

  try {
    let focused = 0;
    const target = { focus: () => { focused++; } };
    const cleanup = attachFocusOnOpen(null, target);

    // our stubs run synchronously, so focus should have been called
    assert.equal(focused, 1);

    cleanup();
  } finally {
    (globalThis as any).requestAnimationFrame = originalRAF;
    (globalThis as any).setTimeout = originalSetTimeout;
  }
});
