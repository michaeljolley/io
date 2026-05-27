import { getStaleInstances, destroyInstance } from "./store/instances.js";

let watchdogInterval: ReturnType<typeof setInterval> | undefined;
let lastTick = Date.now();

export function startWatchdog(): void {
  // Event loop stall detection
  const STALL_THRESHOLD_MS = 5000;
  const stallCheck = setInterval(() => {
    const now = Date.now();
    const drift = now - lastTick - 1000; // expected 1s interval
    if (drift > STALL_THRESHOLD_MS) {
      console.warn(
        `[watchdog] Event loop stall detected: ${drift}ms drift.`
      );
    }
    lastTick = now;
  }, 1000);
  stallCheck.unref();

  // Zombie instance detection (every 5 minutes)
  watchdogInterval = setInterval(async () => {
    const stale = getStaleInstances(30);
    for (const instance of stale) {
      console.warn(
        `[watchdog] Zombie instance detected: ${instance.id} (squad: ${instance.squad_id}). Destroying...`
      );
      try {
        await destroyInstance(instance.id);
      } catch (err) {
        console.error(`[watchdog] Failed to destroy instance ${instance.id}:`, err);
      }
    }
  }, 5 * 60_000);
  watchdogInterval.unref();
}

export function stopWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = undefined;
  }
}
