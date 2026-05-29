import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempHome = mkdtempSync(join(tmpdir(), "io-token-tracker-"));
const originalHome = process.env.HOME;
process.env.HOME = tempHome;

const { attachTokenTracker } = await import("./token-tracker.js");
const { closeDb } = await import("../store/db.js");
const { getTokenUsageSummary } = await import("../store/token-usage.js");

beforeEach(() => {
  closeDb();
  rmSync(join(tempHome, ".io"), { recursive: true, force: true });
});

after(() => {
  closeDb();
  process.env.HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
});

test("attachTokenTracker uses billed AIU cost from Copilot usage events when present", () => {
  const handlers: Array<(event: any) => void> = [];
  const session = {
    on: (_event: string, handler: (event: any) => void) => {
      handlers.push(handler);
      return () => {};
    },
  } as any;

  const flush = attachTokenTracker(session, {});

  handlers[0]({
    data: {
      model: "gpt-4.1",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      copilotUsage: {
        totalNanoAiu: 1_250_000_000_000_000,
      },
    },
  });

  const totals = flush();

  assert.equal(totals.totalInputTokens, 1_000_000);
  assert.equal(totals.totalOutputTokens, 1_000_000);
  assert.equal(totals.totalCostUsd, 12.5);

  const summary = getTokenUsageSummary();
  assert.equal(summary.total_records, 1);
  assert.equal(summary.total_cost_usd, 12.5);
});

test("attachTokenTracker falls back to estimated pricing when billed AIU data is absent", () => {
  const handlers: Array<(event: any) => void> = [];
  const session = {
    on: (_event: string, handler: (event: any) => void) => {
      handlers.push(handler);
      return () => {};
    },
  } as any;

  const flush = attachTokenTracker(session, {});

  handlers[0]({
    data: {
      model: "gpt-4.1",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    },
  });

  const totals = flush();

  assert.equal(totals.totalCostUsd, 10);

  const summary = getTokenUsageSummary();
  assert.equal(summary.total_records, 1);
  assert.equal(summary.total_cost_usd, 10);
});
