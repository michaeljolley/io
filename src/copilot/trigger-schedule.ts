import { getSchedule, updateScheduleLastRun, type Schedule } from "../store/schedules.js";
import { sendToOrchestrator } from "./orchestrator.js";
import { buildSquadScopedPrompt } from "./io-scheduler.js";

/**
 * Trigger a schedule immediately, bypassing cron timing.
 * Returns the schedule if triggered successfully, or undefined if not found.
 */
export function triggerSchedule(id: string): Schedule | undefined {
  const schedule = getSchedule(id);
  if (!schedule) return undefined;

  updateScheduleLastRun(schedule.id);

  if (schedule.type === "squad") {
    const agenda = schedule.agenda || "triage";
    const prompt = `[Squad Schedule] Run "${agenda}" stand-up for squad ${schedule.squad_id}. Agenda: ${agenda}`;
    sendToOrchestrator(prompt, "scheduler", (_text, done) => {
      if (done) {
        console.log(`[trigger] Squad stand-up completed for ${schedule.squad_id}`);
      }
    });
  } else {
    sendToOrchestrator(buildSquadScopedPrompt(schedule), "io-scheduler", (_text, done) => {
      if (done) {
        console.log(`[trigger] IO schedule ${schedule.id} completed.`);
      }
    });
  }

  return schedule;
}
