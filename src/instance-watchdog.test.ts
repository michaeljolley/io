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
  describe("findStaleInstances — active instances", () => {
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

    it("does not flag non-active/non-merging instances", () => {
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

    it("skips active instances whose latest task status is done (#261)", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'active', datetime('now', '-60 minutes'))
      `).run("test-squad--task-done", "test-squad", "/tmp/wt7", "test-squad/instance/task-done");

      db.prepare(`
        INSERT INTO agent_tasks (task_id, agent_slug, description, status, instance_id, started_at, completed_at)
        VALUES (?, ?, ?, 'done', ?, datetime('now', '-35 minutes'), datetime('now', '-34 minutes'))
      `).run("task-done-1", "agent-1", "Finished work", "test-squad--task-done");

      const stale = findStaleInstances(30 * 60_000);
      assert.strictEqual(stale.length, 0);
    });
  });

  describe("findStaleInstances — merging instances (#267)", () => {
    it("detects merging instance older than merging threshold", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'merging', datetime('now', '-30 minutes'))
      `).run("test-squad--stuck-merge", "test-squad", "/tmp/wt-merge1", "test-squad/instance/merge1");

      // Task completed 10 minutes ago — merging has been stuck since then
      db.prepare(`
        INSERT INTO agent_tasks (task_id, agent_slug, description, status, instance_id, started_at, completed_at)
        VALUES (?, ?, ?, 'done', ?, datetime('now', '-15 minutes'), datetime('now', '-10 minutes'))
      `).run("task-merge-1", "agent-1", "Work done", "test-squad--stuck-merge");

      // 10 min since last task completed > 5 min merging threshold
      const stale = findStaleInstances(30 * 60_000, 5 * 60_000);
      assert.strictEqual(stale.length, 1);
      assert.strictEqual(stale[0].instance.id, "test-squad--stuck-merge");
      assert.strictEqual(stale[0].instance.status, "merging");
    });

    it("does not flag merging instance younger than merging threshold", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'merging', datetime('now', '-30 minutes'))
      `).run("test-squad--fresh-merge", "test-squad", "/tmp/wt-merge2", "test-squad/instance/merge2");

      // Task completed 2 minutes ago — merging just started
      db.prepare(`
        INSERT INTO agent_tasks (task_id, agent_slug, description, status, instance_id, started_at, completed_at)
        VALUES (?, ?, ?, 'done', ?, datetime('now', '-5 minutes'), datetime('now', '-2 minutes'))
      `).run("task-merge-2", "agent-1", "Work done", "test-squad--fresh-merge");

      // 2 min since last task completed < 5 min merging threshold
      const stale = findStaleInstances(30 * 60_000, 5 * 60_000);
      assert.strictEqual(stale.length, 0);
    });

    it("uses created_at as fallback when merging instance has no tasks", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'merging', datetime('now', '-10 minutes'))
      `).run("test-squad--no-tasks-merge", "test-squad", "/tmp/wt-merge3", "test-squad/instance/merge3");

      // No tasks at all — falls back to created_at (10 min ago > 5 min threshold)
      const stale = findStaleInstances(30 * 60_000, 5 * 60_000);
      assert.strictEqual(stale.length, 1);
      assert.strictEqual(stale[0].instance.id, "test-squad--no-tasks-merge");
    });

    it("does not apply done-task skip logic to merging instances", () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO squad_instances (id, master_squad_slug, worktree_path, branch_name, status, created_at)
        VALUES (?, ?, ?, ?, 'merging', datetime('now', '-30 minutes'))
      `).run("test-squad--merging-done-task", "test-squad", "/tmp/wt-merge4", "test-squad/instance/merge4");

      // Latest task is done — but for merging instances this should NOT skip
      db.prepare(`
        INSERT INTO agent_tasks (task_id, agent_slug, description, status, instance_id, started_at, completed_at)
        VALUES (?, ?, ?, 'done', ?, datetime('now', '-20 minutes'), datetime('now', '-10 minutes'))
      `).run("task-merge-4", "agent-1", "Done", "test-squad--merging-done-task");

      // 10 min since task completed > 5 min merging threshold — should be detected
      const stale = findStaleInstances(30 * 60_000, 5 * 60_000);
      assert.strictEqual(stale.length, 1);
      assert.strictEqual(stale[0].instance.id, "test-squad--merging-done-task");
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

      await new Promise((r) => setTimeout(r, 150));
      stop();

      assert.ok(aborted.includes("test-squad--stale"));

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

      stop();

      await new Promise((r) => setTimeout(r, 150));
      assert.strictEqual(abortCount, 0);
    });
  });
});
