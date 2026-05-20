/**
 * Daemon liveness watchdog.
 *
 * Uses a periodic setInterval to detect event loop stalls. If the interval
 * fires significantly late, the event loop was blocked for that duration.
 *
 * - Warning logged if stall exceeds WARN_THRESHOLD_MS (30s)
 * - Process exits if stall exceeds FATAL_THRESHOLD_MS (60s), relying on
 *   the process supervisor to restart
 */

const DEFAULT_CHECK_INTERVAL_MS = 30_000;
const DEFAULT_WARN_THRESHOLD_MS = 30_000;
const DEFAULT_FATAL_THRESHOLD_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let lastTick: number = 0;

export interface WatchdogOptions {
  checkIntervalMs?: number;
  warnThresholdMs?: number;
  fatalThresholdMs?: number;
  onStall?: (durationMs: number) => void;
  onFatal?: (durationMs: number) => void;
}

/**
 * Start the event loop watchdog. Returns a stop function.
 */
export function startWatchdog(opts: WatchdogOptions = {}): () => void {
  const checkInterval = opts.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  const warnThreshold = opts.warnThresholdMs ?? DEFAULT_WARN_THRESHOLD_MS;
  const fatalThreshold = opts.fatalThresholdMs ?? DEFAULT_FATAL_THRESHOLD_MS;

  lastTick = Date.now();

  timer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastTick;
    const stallMs = elapsed - checkInterval;

    if (stallMs >= fatalThreshold) {
      console.error(
        `[watchdog] FATAL: event loop stalled for ${Math.round(stallMs / 1000)}s (threshold: ${Math.round(fatalThreshold / 1000)}s) at ${new Date(now).toISOString()}`,
      );
      if (opts.onFatal) {
        opts.onFatal(stallMs);
      } else {
        process.exit(1);
      }
    } else if (stallMs >= warnThreshold) {
      console.error(
        `[watchdog] WARNING: event loop stalled for ${Math.round(stallMs / 1000)}s at ${new Date(now).toISOString()}`,
      );
      opts.onStall?.(stallMs);
    }

    lastTick = now;
  }, checkInterval);

  timer.unref();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
