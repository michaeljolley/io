import { describe, it, expect, vi } from "vitest";
import { attachFocusOnOpen } from "./focusOnAnimation";

describe("attachFocusOnOpen", () => {
  it("focuses target when container emits animationend/transitionend", () => {
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

    const target = { focus: vi.fn() };
    const cleanup = attachFocusOnOpen(container, target);

    // simulate animationend
    handlers["animationend"]?.forEach((h) => h());
    expect(target.focus).toHaveBeenCalled();

    cleanup();
  });

  it("fallback focuses target via raf+timeout when no animation event fires", () => {
    vi.useFakeTimers();
    const target = { focus: vi.fn() };
    const cleanup = attachFocusOnOpen(null, target);

    // advance timers to trigger rAF and timeout
    vi.runAllTimers();

    expect(target.focus).toHaveBeenCalled();
    cleanup();
    vi.useRealTimers();
  });
});