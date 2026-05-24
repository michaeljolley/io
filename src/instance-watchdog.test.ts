import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setDbPathForTests, closeDb, getDb } from "./store/db.js";
import { ensureInstanceTables } from "./store/instances.js";
import { findStaleInstances, startInstanceWatchdog } from "./instance-watchdog.js";

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-inst-watchdog-test-"));
  setDbPathForTests(join(tmpDir, "io.db"));
  ensureInstanceTables();
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM agent_tasks").run();
  db.prepare("DELETE FROM squad_instances").run();
  db.prepare("DELETE FROM squads").run();
  db.prepare("INSERT INTO squads (slug, name, project_path) VALUES (?, ?, ?)").run("test-squad", "Test", "/tmp/test");
});

describe("instance watchdog", () => {
  describe("findStaleInstances", () => {
    it("detects stale active instances with no task activity", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-60 minutes'))
      `).run("test-squad--old", "test-squad", "/tmp/wt", "test-squad/instance/old");

      const stale = findStaleInstances(30 * 60_000);
      assert.strictEqual(stale.length, 1);
      assert.strictEqual(stale[0].instance.id, "test-squad--old");
    });

    it("does not flag instances with recent task activity", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-60 minutes'))
      `).run("test-squad--recent", "test-squad", "/tmp/wt2", "test-squad/instance/recent");

      db.prepare(`
        INSERT INTO agent_tasks (task_id, agent_slug, description, instance_id, started_at)
        VALUES (?, ?, ?, ?, datetime('now', '-5 minutes'))
      `).run("task-recent", "agent-1", "Work", "test-squad--recent");

      const stale = findStaleInstances(30 * 60_000);
      assert.strictEqual(stale.length, 0);
    });

    it("does not flag non-active instances", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'done', datetime('now', '-120 minutes'))
      `).run("test-squad--done", "test-squad", "/tmp/wt3", "test-squad/instance/done");

      const stale = findStaleInstances(30 * 60_000);
      assert.strictEqual(stale.length, 0);
    });

    it("calculates idleMs correctly relative to now", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-45 minutes'))
      `).run("test-squad--mid", "test-squad", "/tmp/wt4", "test-squad/instance/mid");

      const stale = findStaleInstances(30 * 60_000);
      assert.strictEqual(stale.length, 1);
      assert.ok(stale[0].idleMs >= 44 * 60_000);
      assert.ok(stale[0].idleMs <= 46 * 60_000);
    });
  });

  describe("startInstanceWatchdog", () => {
    it("calls onAbort for stale instances and stops cleanly", async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-60 minutes'))
      `).run("test-squad--stale", "test-squad", "/tmp/wt5", "test-squad/instance/stale");

      const aborted: string[] = [];
      const stop = startInstanceWatchdog({
        checkIntervalMs: 50,
        staleThresholdMs: 30 * 60_000,
        onAbort: (inst) => aborted.push(inst.id),
      });

      // Wait for at least one interval to fire
      await new Promise((r) => setTimeout(r, 150));
      stop();

      assert.ok(aborted.includes("test-squad--stale"));

      // Verify it was marked failed
      const row = db.prepare("SELECT status FROM squad_instances WHERE id = ?").get("test-squad--stale") as { status: string };
      assert.strictEqual(row.status, "failed");
    });

    it("stop function prevents further checks", async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-60 minutes'))
      `).run("test-squad--late", "test-squad", "/tmp/wt6", "test-squad/instance/late");

      let abortCount = 0;
      const stop = startInstanceWatchdog({
        checkIntervalMs: 50,
        staleThresholdMs: 30 * 60_000,
        onAbort: () => abortCount++,
      });

      stop(); // Stop immediately before any tick fires

      await new Promise((r) => setTimeout(r, 150));
      // Instance should NOT have been aborted since we stopped before first tick
      assert.strictEqual(abortCount, 0);
    });
  });
});
