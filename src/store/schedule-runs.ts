import { getDb } from "./db.js";

export interface ScheduleRun {
  id: number;
  schedule_type: string;
  schedule_id: number;
  schedule_name: string;
  squad_slug: string | null;
  status: string;
  error_text: string | null;
  notification_id: number | null;
  started_at: string;
  completed_at: string | null;
}

/** Create a new run in 'running' status. Returns the row. */
export function startScheduleRun(input: {
  schedule_type: string;
  schedule_id: number;
  schedule_name: string;
  squad_slug?: string;
}): ScheduleRun {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO schedule_runs (schedule_type, schedule_id, schedule_name, squad_slug)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.schedule_type,
      input.schedule_id,
      input.schedule_name,
      input.squad_slug ?? null,
    );
  return db
    .prepare("SELECT * FROM schedule_runs WHERE id = ?")
    .get(info.lastInsertRowid) as ScheduleRun;
}

/** Mark a run complete (success). Optionally link a notification_id. */
export function completeScheduleRun(id: number, notificationId?: number): void {
  getDb()
    .prepare(
      `UPDATE schedule_runs
       SET status = 'done', completed_at = CURRENT_TIMESTAMP, notification_id = ?
       WHERE id = ?`,
    )
    .run(notificationId ?? null, id);
}

/** Mark a run failed with an error message. */
export function failScheduleRun(id: number, errorText: string): void {
  getDb()
    .prepare(
      `UPDATE schedule_runs
       SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_text = ?
       WHERE id = ?`,
    )
    .run(errorText, id);
}

/** Get last N runs for a specific schedule. Newest first. */
export function getScheduleRuns(
  scheduleType: string,
  scheduleId: number,
  limit = 10,
): ScheduleRun[] {
  return getDb()
    .prepare(
      `SELECT * FROM schedule_runs
       WHERE schedule_type = ? AND schedule_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .all(scheduleType, scheduleId, limit) as ScheduleRun[];
}

/** Prune runs older than the given number of days. Returns rows deleted. */
export function pruneOldScheduleRuns(olderThanDays: number): number {
  const info = getDb()
    .prepare(
      `DELETE FROM schedule_runs
       WHERE started_at < datetime('now', '-' || ? || ' days')`,
    )
    .run(olderThanDays);
  return info.changes;
}
