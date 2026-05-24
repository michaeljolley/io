// Squad scheduler — fires recurring "stand-up" meetings on a cron schedule.
//
// Design:
//   - Runs as a single setInterval on the daemon (TICK_MS).
//   - Each tick: fetch schedules whose next_run_at is in the past.
//   - For each due schedule: compose a stand-up prompt and delegate it to the
//     squad lead via the existing delegateToAgent() pipeline. The lead then
//     orchestrates the agenda by delegating subtasks to teammates internally.
//   - After firing, advance next_run_at to the next cron occurrence.
//
// Schedules survive daemon restarts because next_run_at is persisted. On
// startup we backfill any next_run_at fields that became stale (or are NULL).

import { listSchedules, listDueSchedules, recordScheduleRun, setScheduleTimestamps, updateNextRun, type SquadSchedule } from "../store/schedules.js";
import { getSquad } from "../store/squads.js";
import { delegateToAgent } from "./agents.js";
import { nextRun } from "./cron.js";
import { notifyBackground } from "../notify.js";
import { startScheduleRun, completeScheduleRun, failScheduleRun } from "../store/schedule-runs.js";
import { createFeedEntry } from "../store/feed.js";
import { shouldRouteToInbox } from "./tools.js";

const TICK_MS = 30_000;

const AGENDA_BLOCKS: Record<string, string> = {
  triage: `**Triage**
- Use the GitHub CLI (\`gh issue list\`) to pull open issues with the \`needs-triage\` label.
- For each issue: read the body and decide on appropriate labels (priority, area, type, etc).
- Apply labels with \`gh issue edit <num> --add-label "..."\` and remove \`needs-triage\` once labelled.
- If the issue lacks information, post a clarifying comment with \`gh issue comment\` instead of labelling, and leave \`needs-triage\` on it.`,
  prioritize: `**Prioritize**
- Identify open issues that are ready to be worked on: properly labelled, not blocked, no \`needs-triage\` or \`needs-review\` label, no open PR already addressing them.
- Rank by priority labels and surface the top candidate.
- After the stand-up, the team lead should immediately begin work on the highest-priority ready issue by delegating it to the right teammate.`,
  ideation: `**Ideation**
- Brainstorm 1–3 concrete improvements or new features for the project.
- Discuss as a team (use \`delegate_to_teammate\` to gather input from members whose expertise fits the idea).
- For each idea the team agrees on, create a GitHub issue with \`gh issue create\` tagged with the \`needs-review\` label so the human can approve it before work begins.`,
};

function buildStandupPrompt(squad: { name: string; slug: string; project_path: string }, schedule: SquadSchedule): string {
  const blocks = schedule.agenda
    .map((item) => AGENDA_BLOCKS[item] ?? `**${item}** _(no built-in template — improvise)_`)
    .join("\n\n");
  const notes = schedule.notes ? `\n\n**Operator notes:** ${schedule.notes}` : "";
  return `# Scheduled stand-up: ${schedule.name}

You are the team lead for the **${squad.name}** squad (\`${squad.slug}\`). Run a stand-up meeting now.

**Project path:** \`${squad.project_path}\` — \`cd\` here before invoking the GitHub CLI so it picks up the right repo.

**Agenda** (work through these in order; use \`delegate_to_teammate\` to pull in the right specialist for each item):

${blocks}

When you finish the agenda, summarise what was triaged, what was prioritised (and what work you've kicked off), and what new issues were filed during ideation.${notes}`;
}

let timer: ReturnType<typeof setInterval> | undefined;
const inFlight = new Set<number>();

async function fireSchedule(schedule: SquadSchedule): Promise<void> {
  if (inFlight.has(schedule.id)) return;
  const squad = getSquad(schedule.squad_slug);
  if (!squad) {
    console.error(`[io] scheduler: squad "${schedule.squad_slug}" missing for schedule ${schedule.id}; disabling next_run_at`);
    updateNextRun(schedule.id, null);
    return;
  }
  inFlight.add(schedule.id);
  const ranAt = new Date();
  let nextIso: string | null = null;
  try {
    nextIso = nextRun(schedule.cron_expr, ranAt).toISOString();
  } catch (err) {
    console.error(`[io] scheduler: cron parse error for schedule ${schedule.id}:`, err instanceof Error ? err.message : err);
  }
  recordScheduleRun(schedule.id, ranAt, nextIso);

  const prompt = buildStandupPrompt(
    { name: squad.name, slug: squad.slug, project_path: squad.project_path },
    schedule,
  );
  console.log(`[io] scheduler: firing schedule "${schedule.name}" for squad "${squad.slug}" (next run: ${nextIso ?? "never"})`);
  const run = startScheduleRun({
    schedule_type: "squad",
    schedule_id: schedule.id,
    schedule_name: schedule.name,
    squad_slug: squad.slug,
  });
  try {
    await delegateToAgent(squad.slug, prompt, (_taskId, result) => {
      if (shouldRouteToInbox(prompt)) {
        createFeedEntry({ type: "inbox", title: `[${squad.slug}] ${schedule.name}`, body: result });
        console.error(`[io] Schedule ${schedule.id} result routed to inbox`);
        completeScheduleRun(run.id, 0);
      } else {
        void notifyBackground({
          source: {
            type: "squad-schedule",
            scheduleId: schedule.id,
            squadSlug: squad.slug,
            scheduleName: schedule.name,
          },
          title: `${squad.name}: ${schedule.name}`,
          text: result,
        }).then((notifyResult) => {
          completeScheduleRun(run.id, notifyResult.id);
        }).catch((err) => {
          failScheduleRun(run.id, err instanceof Error ? err.message : String(err));
        });
      }
    });
  } catch (err) {
    failScheduleRun(run.id, err instanceof Error ? err.message : String(err));
    console.error(`[io] scheduler: failed to delegate stand-up for schedule ${schedule.id}:`, err instanceof Error ? err.message : err);
  } finally {
    inFlight.delete(schedule.id);
  }
}

async function tick(): Promise<void> {
  let due: SquadSchedule[];
  try {
    due = listDueSchedules(new Date());
  } catch (err) {
    console.error("[io] scheduler tick failed:", err instanceof Error ? err.message : err);
    return;
  }
  for (const s of due) {
    // Sequential — avoid stampeding multiple stand-ups simultaneously.
    await fireSchedule(s);
  }
}

/**
 * Backfill next_run_at for any schedules where it's NULL or already in the past
 * but should not have fired (e.g. daemon was offline). We deliberately advance
 * to the next future occurrence rather than replaying missed runs.
 */
export function reconcileSchedules(now: Date = new Date()): void {
  for (const s of listSchedules()) {
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
      updateNextRun(s.id, next.toISOString());
    } catch (err) {
      console.error(`[io] scheduler: invalid cron "${s.cron_expr}" on schedule ${s.id}; disabling next_run_at:`, err instanceof Error ? err.message : err);
      updateNextRun(s.id, null);
    }
  }
}

export function startScheduler(): void {
  if (timer) return;
  reconcileSchedules();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  console.log(`[io] Scheduler started (tick every ${TICK_MS / 1000}s)`);
}

export function stopScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
}

/**
 * Manually fire a schedule. Used by squad_schedule_run_now.
 *
 * Snapshots last_run_at and next_run_at before firing and restores them
 * after, so a manual fire never disturbs the regular schedule (a user
 * testing a 05:00 schedule at 04:30 should not have today's 05:00 run
 * skipped or shifted). The fireSchedule path itself advances both fields
 * because that's correct for an automatic firing — only manual runs need
 * to leave the schedule untouched.
 */
export async function runScheduleNow(scheduleId: number): Promise<{ ok: boolean; error?: string }> {
  const all = listSchedules();
  const s = all.find((x) => x.id === scheduleId);
  if (!s) return { ok: false, error: `Schedule ${scheduleId} not found` };
  const previousLast = s.last_run_at;
  const previousNext = s.next_run_at;
  try {
    await fireSchedule(s);
  } finally {
    setScheduleTimestamps(scheduleId, previousLast, previousNext);
  }
  return { ok: true };
}
