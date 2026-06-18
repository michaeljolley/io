export type EventTargetLike = {
  addEventListener: (ev: string, handler: () => void) => void;
  removeEventListener: (ev: string, handler: () => void) => void;
};

export function attachFocusOnOpen(container: EventTargetLike | null, target: { focus?: () => void } | null) {
  let rafId: number | null = null;
  let timeoutId: number | null = null;
  let focused = false;

  const focusOnce = () => {
    if (focused) return;
    focused = true;
    target?.focus?.();
  };

  const onEnd = () => focusOnce();

  if (container) {
    container.addEventListener("animationend", onEnd);
    container.addEventListener("transitionend", onEnd);
  }

  // requestAnimationFrame + small timeout fallback
  if (typeof requestAnimationFrame !== "undefined") {
    rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        focusOnce();
      }, 180) as unknown as number;
    }) as unknown as number;
  } else {
    // Fallback when requestAnimationFrame is unavailable
    timeoutId = setTimeout(() => {
      focusOnce();
    }, 180) as unknown as number;
  }

  return () => {
    if (container) {
      container.removeEventListener("animationend", onEnd);
      container.removeEventListener("transitionend", onEnd);
    }
    if (rafId != null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafId);
    if (timeoutId != null) clearTimeout(timeoutId as unknown as number);
  };
}
