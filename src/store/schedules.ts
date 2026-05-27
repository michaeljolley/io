import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface Schedule {
  id: string;
  type: "squad" | "io";
  squad_id: string | null;
  cron: string;
  agenda: string;
  prompt: string;
  enabled: number;
  last_run: string | null;
  created_at: string;
}

export function createSchedule(input: {
  type: "squad" | "io";
  cron: string;
  squad_id?: string;
  agenda?: string;
  prompt?: string;
}): Schedule {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO schedules (id, type, squad_id, cron, agenda, prompt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.type,
    input.squad_id ?? null,
    input.cron,
    input.agenda ?? "",
    input.prompt ?? ""
  );
  return db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule;
}

export function listSchedules(type?: "squad" | "io"): Schedule[] {
  const db = getDb();
  if (type) {
    return db
      .prepare("SELECT * FROM schedules WHERE type = ? ORDER BY created_at")
      .all(type) as Schedule[];
  }
  return db.prepare("SELECT * FROM schedules ORDER BY created_at").all() as Schedule[];
}

export function updateScheduleLastRun(id: string): void {
  const db = getDb();
  db.prepare("UPDATE schedules SET last_run = datetime('now') WHERE id = ?").run(id);
}

export function toggleSchedule(id: string, enabled: boolean): void {
  const db = getDb();
  db.prepare("UPDATE schedules SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

export function deleteSchedule(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM schedules WHERE id = ?").run(id);
}
