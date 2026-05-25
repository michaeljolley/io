/**
 * Instance liveness watchdog.
 *
 * Periodically checks for active squad instances that haven't had any
 * task activity beyond a configurable timeout and auto-aborts them.
 * Also detects instances stuck in 'merging' state (#267).
 */

import { getDb } from "./store/db.js";
import { updateInstanceStatus, type SquadInstance } from "./store/instances.js";
import { createFeedEntry } from "./store/feed.js";

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60_000;  // Check every 5 minutes
const DEFAULT_STALE_THRESHOLD_MS = 30 * 60_000; // 30 minutes with no task activity
const DEFAULT_MERGING_THRESHOLD_MS = 5 * 60_000; // 5 minutes stuck in merging

export interface InstanceWatchdogOptions {
  checkIntervalMs?: number;
  staleThresholdMs?: number;
  mergingThresholdMs?: number;
  onAbort?: (instance: SquadInstance, idleMs: number) => void;
}

/**
 * Find instances that are stale or stuck.
 *
 * For 'active' instances: uses task-activity-based staleness (last started_at/completed_at).
 * For 'merging' instances: uses wall-clock since entering merging state (shorter threshold).
 */
export function findStaleInstances(
  thresholdMs: number,
  mergingThresholdMs: number = DEFAULT_MERGING_THRESHOLD_MS,
): Array<{ instance: SquadInstance; idleMs: number }> {
  const db = getDb();
  const now = Date.now();

  const instances = db.prepare(
    "SELECT * FROM squad_instances WHERE status IN ('active', 'merging')"
  ).all() as SquadInstance[];

  const stale: Array<{ instance: SquadInstance; idleMs: number }> = [];

  for (const instance of instances) {
    if (instance.status === "merging") {
      // Merging instances: use the time they've been in merging state.
      // We approximate this from completed_at (set when status changes to terminal)
      // or fall back to created_at. Since updateInstanceStatus doesn't set completed_at
      // for non-terminal states, we use a query on the DB's internal timestamp approach.
      // Best proxy: last task completed_at (since merging happens after task completion).
      const lastTaskCompleted = db.prepare(`
        SELECT MAX(completed_at) AS last_ts
        FROM agent_tasks
        WHERE instance_id = ?
      `).get(instance.id) as { last_ts: string | null } | undefined;

      const rawTs = lastTaskCompleted?.last_ts ?? instance.created_at;
      const lastTs = new Date(rawTs.includes("T") ? rawTs : rawTs + "Z").getTime();
      const idleMs = now - lastTs;

      if (idleMs >= mergingThresholdMs) {
        stale.push({ instance, idleMs });
      }
      continue;
    }

    // Active instances: skip those whose most recent task completed successfully —
    // auto-complete in agents.ts handles these (#261)
    const latestTaskStatus = db.prepare(`
      SELECT status FROM agent_tasks
      WHERE instance_id = ?
      ORDER BY COALESCE(completed_at, started_at) DESC
      LIMIT 1
    `).get(instance.id) as { status: string } | undefined;

    if (latestTaskStatus?.status === "done") continue;

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
  const mergingThreshold = opts.mergingThresholdMs ?? DEFAULT_MERGING_THRESHOLD_MS;

  const timer = setInterval(() => {
    try {
      const staleInstances = findStaleInstances(staleThreshold, mergingThreshold);

      for (const { instance, idleMs } of staleInstances) {
        const reason = instance.status === "merging" ? "stuck in merging" : "idle";
        console.error(
          `[instance-watchdog] Auto-aborting ${reason} instance "${instance.id}" — ${Math.round(idleMs / 60_000)}m (threshold: ${Math.round(instance.status === "merging" ? mergingThreshold / 60_000 : staleThreshold / 60_000)}m)`
        );

        updateInstanceStatus(instance.id, "failed");

        createFeedEntry({
          type: "notification",
          title: `[${instance.master_squad_slug}] Instance auto-aborted`,
          body: `Instance "${instance.id}" was auto-aborted (${reason}) after ${Math.round(idleMs / 60_000)} minutes. Worktree preserved at: ${instance.worktree_path}`,
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
