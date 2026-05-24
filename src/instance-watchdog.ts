/**
 * Instance liveness watchdog.
 *
 * Periodically checks for active squad instances that haven't had any
 * task activity beyond a configurable timeout and auto-aborts them.
 */

import { getDb } from "./store/db.js";
import { updateInstanceStatus, type SquadInstance } from "./store/instances.js";
import { createFeedEntry } from "./store/feed.js";

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60_000;  // Check every 5 minutes
const DEFAULT_STALE_THRESHOLD_MS = 30 * 60_000; // 30 minutes with no task activity

export interface InstanceWatchdogOptions {
  checkIntervalMs?: number;
  staleThresholdMs?: number;
  onAbort?: (instance: SquadInstance, idleMs: number) => void;
}

/**
 * Find active instances whose last task activity exceeds the threshold.
 * "Activity" is defined as the most recent started_at or completed_at
 * in agent_tasks for that instance, or the instance's created_at if no tasks.
 */
export function findStaleInstances(thresholdMs: number): Array<{ instance: SquadInstance; idleMs: number }> {
  const db = getDb();
  const now = Date.now();

  const activeInstances = db.prepare(
    "SELECT * FROM squad_instances WHERE status = 'active'"
  ).all() as SquadInstance[];

  const stale: Array<{ instance: SquadInstance; idleMs: number }> = [];

  for (const instance of activeInstances) {
    // Find the most recent task activity for this instance
    const lastActivity = db.prepare(`
      SELECT MAX(COALESCE(completed_at, started_at)) AS last_ts
      FROM agent_tasks
      WHERE instance_id = ?
    `).get(instance.id) as { last_ts: string | null } | undefined;

    const rawTs = lastActivity?.last_ts ?? instance.created_at;
    const lastTs = new Date(rawTs.includes("T") ? rawTs : rawTs + "Z").getTime();
    const idleMs = now - lastTs;

    if (idleMs >= thresholdMs) {
      stale.push({ instance, idleMs });
    }
  }

  return stale;
}

/**
 * Start the instance watchdog. Returns a stop function.
 */
export function startInstanceWatchdog(opts: InstanceWatchdogOptions = {}): () => void {
  const checkInterval = opts.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  const staleThreshold = opts.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;

  const timer = setInterval(() => {
    try {
      const staleInstances = findStaleInstances(staleThreshold);

      for (const { instance, idleMs } of staleInstances) {
        console.error(
          `[instance-watchdog] Auto-aborting stale instance "${instance.id}" — idle for ${Math.round(idleMs / 60_000)}m (threshold: ${Math.round(staleThreshold / 60_000)}m)`
        );

        updateInstanceStatus(instance.id, "failed");

        createFeedEntry({
          type: "notification",
          title: `[${instance.master_squad_slug}] Instance auto-aborted`,
          body: `Instance "${instance.id}" was auto-aborted after ${Math.round(idleMs / 60_000)} minutes of inactivity. Worktree preserved at: ${instance.worktree_path}`,
          source_type: "instance-watchdog",
        });

        if (opts.onAbort) {
          opts.onAbort(instance, idleMs);
        }
      }
    } catch (err) {
      console.error("[instance-watchdog] Error during check:", err);
    }
  }, checkInterval);

  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
