import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tempHome = mkdtempSync(join(tmpdir(), "io-squad-colors-"));
process.env.HOME = tempHome;

const { createSquad } = await import("./squads.js");
const { closeDb } = await import("./db.js");
const { SQUAD_COLOR_PALETTE, pickSquadColor } = await import("./squad-colors.js");

beforeEach(() => {
  closeDb();
  rmSync(join(tempHome, ".io"), { recursive: true, force: true });
});

after(() => {
  closeDb();
  rmSync(tempHome, { recursive: true, force: true });
});

test("pickSquadColor picks from unused colors first", () => {
  const picked = pickSquadColor([SQUAD_COLOR_PALETTE[0]], () => 0);
  assert.equal(picked, SQUAD_COLOR_PALETTE[1]);
});

test("createSquad assigns unique colors while palette has unused entries", () => {
  const seen = new Set<string>();
  for (let i = 0; i < SQUAD_COLOR_PALETTE.length; i++) {
    const squad = createSquad(`Squad ${i}`, "Testverse");
    assert.ok(squad.color);
    assert.equal(seen.has(squad.color), false);
    seen.add(squad.color);
  }
});

test("createSquad still assigns a palette color after palette is exhausted", () => {
  for (let i = 0; i < SQUAD_COLOR_PALETTE.length; i++) {
    createSquad(`Squad ${i}`, "Testverse");
  }
  const overflowSquad = createSquad("Overflow Squad", "Testverse");
  assert.ok(SQUAD_COLOR_PALETTE.includes(overflowSquad.color as (typeof SQUAD_COLOR_PALETTE)[number]));
});
