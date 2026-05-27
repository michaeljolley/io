import { listSchedules, updateScheduleLastRun, type Schedule } from "../store/schedules.js";
import { sendToOrchestrator } from "./orchestrator.js";

let ioSchedulerInterval: ReturnType<typeof setInterval> | undefined;

export function startIoScheduler(): void {
  ioSchedulerInterval = setInterval(() => {
    checkIoSchedules();
  }, 60_000);
  ioSchedulerInterval.unref();
}

function checkIoSchedules(): void {
  const schedules = listSchedules("io");
  const now = new Date();

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    if (!isDue(schedule.cron, schedule.last_run, now)) continue;
    if (!schedule.squad_id) {
      console.warn(`[io-scheduler] Schedule ${schedule.id} skipped: missing squad_id.`);
      continue;
    }

    updateScheduleLastRun(schedule.id);

    sendToOrchestrator(buildSquadScopedPrompt(schedule), "io-scheduler", (_text, done) => {
      if (done) {
        console.log(`[io-scheduler] Schedule ${schedule.id} completed.`);
      }
    });
  }
}

export function buildSquadScopedPrompt(schedule: Pick<Schedule, "squad_id" | "prompt">): string {
  const squadId = schedule.squad_id ?? "unknown";
  return `[Squad Schedule] Run for squad ${squadId}. Prompt: ${schedule.prompt}`;
}

function isDue(cron: string, lastRun: string | null, now: Date): boolean {
  const parts = cron.split(" ");
  if (parts.length !== 5) return false;

  const [minSpec, hourSpec, daySpec, monthSpec, weekdaySpec] = parts;

  if (!matchesCronField(minSpec, now.getMinutes())) return false;
  if (!matchesCronField(hourSpec, now.getHours())) return false;
  if (!matchesCronField(daySpec, now.getDate())) return false;
  if (!matchesCronField(monthSpec, now.getMonth() + 1)) return false;
  if (!matchesCronField(weekdaySpec, now.getDay())) return false;

  if (lastRun) {
    const lastDate = new Date(lastRun);
    const diffMs = now.getTime() - lastDate.getTime();
    if (diffMs < 60_000) return false;
  }

  return true;
}

function matchesCronField(spec: string, value: number): boolean {
  if (spec === "*") return true;
  if (spec.includes("-")) {
    const [start, end] = spec.split("-").map(Number);
    return value >= start && value <= end;
  }
  if (spec.includes(",")) {
    return spec.split(",").map(Number).includes(value);
  }
  if (spec.startsWith("*/")) {
    const step = parseInt(spec.slice(2), 10);
    return value % step === 0;
  }
  return parseInt(spec, 10) === value;
}

export function stopIoScheduler(): void {
  if (ioSchedulerInterval) {
    clearInterval(ioSchedulerInterval);
    ioSchedulerInterval = undefined;
  }
}
