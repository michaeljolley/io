import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempHome = mkdtempSync(join(tmpdir(), "io-schedules-test-"));
process.env.HOME = tempHome;

const { createSquad } = await import("./squads.js");
const { createSchedule, listSchedules, updateSchedule } = await import("./schedules.js");
const { closeDb } = await import("./db.js");

after(() => {
  closeDb();
  rmSync(tempHome, { recursive: true, force: true });
});

test("createSchedule requires a squad_id", () => {
  assert.throws(
    () =>
      createSchedule({
        type: "io",
        cron: "0 9 * * 1-5",
        squad_id: " ",
        prompt: "summary",
      }),
    /squad_id is required/
  );
});

test("a squad can have multiple schedules", () => {
  const squad = createSquad("Alpha Team", "Marvel");
  const first = createSchedule({
    type: "io",
    squad_id: squad.id,
    cron: "0 9 * * 1-5",
    prompt: "Morning summary",
  });
  const second = createSchedule({
    type: "io",
    squad_id: squad.id,
    cron: "0 17 * * 1-5",
    prompt: "Evening summary",
  });

  const squadScheduleIds = listSchedules("io")
    .filter((schedule) => schedule.squad_id === squad.id)
    .map((schedule) => schedule.id);

  assert.deepEqual(new Set(squadScheduleIds), new Set([first.id, second.id]));
});

test("updateSchedule persists prompt changes and toggles enabled state", () => {
  const squad = createSquad("Beta Team", "DC");
  const schedule = createSchedule({
    type: "squad",
    squad_id: squad.id,
    cron: "0 10 * * 1-5",
    prompt: "Original prompt",
  });

  const updated = updateSchedule(schedule.id, { prompt: "Updated prompt", enabled: true });

  assert.equal(updated.prompt, "Updated prompt");
  assert.equal(updated.enabled, 1);

  const persisted = listSchedules("squad").find((item) => item.id === schedule.id);
  assert.ok(persisted);
  assert.equal(persisted?.prompt, "Updated prompt");
  assert.equal(persisted?.enabled, 1);
});
