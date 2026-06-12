import { type RefObject, useCallback, useEffect, useRef } from "react";

const BOTTOM_THRESHOLD = 40;

/**
 * Auto-scrolls a container to the bottom when content changes,
 * unless the user has manually scrolled away.
 */
export function useAutoScroll(containerRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  const pinnedRef = useRef(true);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    },
    [containerRef],
  );

  // Detect user scroll to update pinned state
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedRef.current = distanceFromBottom <= BOTTOM_THRESHOLD;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  // Auto-scroll when deps change and user is pinned
  useEffect(() => {
    if (pinnedRef.current) {
      scrollToBottom("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
