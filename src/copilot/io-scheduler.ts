// IO-level scheduler — fires recurring tasks for IO itself, independent of
// any squad. Mirrors the squad scheduler in shape (TICK_MS loop, in-flight
// guard, reconcile on startup) but dispatches into the orchestrator via
// sendToOrchestrator with a `background` source so IO can handle the prompt
// the same way it handles any other user message.

import {
  listIoSchedules,
  listDueIoSchedules,
  recordIoScheduleRun,
  setIoScheduleTimestamps,
  updateIoScheduleNextRun,
  type IoSchedule,
} from "../store/io-schedules.js";
import { sendToOrchestrator } from "./orchestrator.js";
import { nextRun } from "./cron.js";
import { notifyBackground } from "../notify.js";
import { startScheduleRun, completeScheduleRun, failScheduleRun } from "../store/schedule-runs.js";

const TICK_MS = 30_000;

let timer: ReturnType<typeof setInterval> | undefined;
const inFlight = new Set<number>();

function buildPrompt(schedule: IoSchedule): string {
  const header = `# Scheduled task: ${schedule.name}\n\n_This prompt was fired automatically by the IO scheduler. Cron expression: \`${schedule.cron_expr}\`._`;
  const notes = schedule.notes
    ? `\n\n**Operator notes:** ${schedule.notes}`
    : "";
  return `${header}\n\n${schedule.prompt}${notes}`;
}

async function fireSchedule(schedule: IoSchedule): Promise<void> {
  if (inFlight.has(schedule.id)) return;
  inFlight.add(schedule.id);
  const ranAt = new Date();
  let nextIso: string | null = null;
  try {
    nextIso = nextRun(schedule.cron_expr, ranAt).toISOString();
  } catch (err) {
    console.error(
      `[io] io-scheduler: cron parse error for schedule ${schedule.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
  recordIoScheduleRun(schedule.id, ranAt, nextIso);

  console.log(
    `[io] io-scheduler: firing schedule "${schedule.name}" (next run: ${nextIso ?? "never"})`,
  );
  const run = startScheduleRun({
    schedule_type: "io",
    schedule_id: schedule.id,
    schedule_name: schedule.name,
  });
  try {
    let buffer = "";
    await sendToOrchestrator(
      buildPrompt(schedule),
      { type: "background" },
      (text, done) => {
        buffer += text;
        if (done) {
          void notifyBackground({
            source: {
              type: "io-schedule",
              scheduleId: schedule.id,
              scheduleName: schedule.name,
            },
            title: `IO schedule: ${schedule.name}`,
            text: buffer.trim(),
          }).then((notifyResult) => {
            completeScheduleRun(run.id, notifyResult.id);
          }).catch((err) => {
            failScheduleRun(run.id, err instanceof Error ? err.message : String(err));
          });
        }
      },
    );
  } catch (err) {
    failScheduleRun(run.id, err instanceof Error ? err.message : String(err));
    console.error(
      `[io] io-scheduler: failed to dispatch schedule ${schedule.id}:`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    inFlight.delete(schedule.id);
  }
}

async function tick(): Promise<void> {
  let due: IoSchedule[];
  try {
    due = listDueIoSchedules(new Date());
  } catch (err) {
    console.error(
      "[io] io-scheduler tick failed:",
      err instanceof Error ? err.message : err,
    );
    return;
  }
  for (const s of due) {
    await fireSchedule(s);
  }
}

/**
 * Backfill next_run_at for any IO schedules that are NULL or stale. We
 * advance to the next future occurrence rather than replaying missed runs
 * — same semantics as the squad scheduler.
 */
export function reconcileIoSchedules(now: Date = new Date()): void {
  for (const s of listIoSchedules()) {
    if (!s.enabled) continue;
    let needsUpdate = false;
    if (!s.next_run_at) {
      needsUpdate = true;
    } else {
      const next = new Date(s.next_run_at);
      if (Number.isNaN(next.getTime()) || next <= now) needsUpdate = true;
    }
    if (!needsUpdate) continue;
    try {
      const next = nextRun(s.cron_expr, now);
      updateIoScheduleNextRun(s.id, next.toISOString());
    } catch (err) {
      console.error(
        `[io] io-scheduler: invalid cron "${s.cron_expr}" on schedule ${s.id}; clearing next_run_at:`,
        err instanceof Error ? err.message : err,
      );
      updateIoScheduleNextRun(s.id, null);
    }
  }
}

export function startIoScheduler(): void {
  if (timer) return;
  reconcileIoSchedules();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // Don't keep the event loop alive on shutdown
  (timer as unknown as { unref?: () => void }).unref?.();
}

export function stopIoScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

/**
 * Force a schedule to run immediately. Used by the `schedule_run_now` tool.
 *
 * The regular tick path (`fireSchedule`) advances `last_run_at` and
 * `next_run_at` as a side effect, which is correct for an automatic firing
 * but is the wrong behaviour for a manual one — a user testing a schedule at
 * 04:30 should not have the 05:00 occurrence skipped or the schedule shifted.
 * We therefore snapshot both timestamps before firing and restore them after,
 * leaving the persisted schedule untouched.
 */
export async function runIoScheduleNow(id: number): Promise<boolean> {
  const all = listIoSchedules();
  const s = all.find((x) => x.id === id);
  if (!s) return false;
  const previousLast = s.last_run_at;
  const previousNext = s.next_run_at;
  try {
    await fireSchedule(s);
  } finally {
    // Restore the original timestamps even if fireSchedule threw, so a
    // failed manual run cannot silently shift the schedule either.
    setIoScheduleTimestamps(id, previousLast, previousNext);
  }
  return true;
}
