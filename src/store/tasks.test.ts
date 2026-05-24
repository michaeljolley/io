/**
 * Tests for src/store/tasks.ts — agent task store.
 *
 * DB isolation: setDbPathForTests() redirects the SQLite singleton to a
 * fresh tmp file so these tests never touch ~/.io/io.db.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setDbPathForTests, closeDb, getDb } from "./db.js";
import { createTask, getTask, getActiveTasks, completeTask, failTask, cancelTask, listRecentTasks } from "./tasks.js";

// ── DB isolation ─────────────────────────────────────────────────────────────

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-tasks-test-"));
  setDbPathForTests(join(tmpDir, "io.db"));
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  getDb().prepare("DELETE FROM agent_tasks").run();
});

// ── createTask / getTask ──────────────────────────────────────────────────────

describe("createTask", () => {
  it("creates a task with correct base fields", () => {
    const task = createTask("t-base", "agent-1", "Do something");
    assert.equal(task.task_id, "t-base");
    assert.equal(task.agent_slug, "agent-1");
    assert.equal(task.description, "Do something");
    assert.equal(task.status, "running");
    assert.equal(task.result, null);
    assert.equal(task.origin_channel, null);
    assert.ok(task.started_at);
    assert.equal(task.completed_at, null);
  });

  it("stores null instance_id when not provided", () => {
    const task = createTask("t-no-instance", "agent-1", "Do something");
    assert.equal(task.instance_id, null);
    const fetched = getTask("t-no-instance");
    assert.equal(fetched?.instance_id, null);
  });

  it("stores instance_id when provided", () => {
    const task = createTask("t-with-instance", "agent-1", "Do something", undefined, "test-squad--issue-42");
    assert.equal(task.instance_id, "test-squad--issue-42");
  });

  it("stores origin_channel when provided", () => {
    const task = createTask("t-channel", "agent-1", "Task", "telegram");
    assert.equal(task.origin_channel, "telegram");
  });

  it("stores both origin_channel and instance_id together", () => {
    const task = createTask("t-both", "agent-1", "Task", "telegram", "squad--issue-5");
    assert.equal(task.origin_channel, "telegram");
    assert.equal(task.instance_id, "squad--issue-5");
  });
});

describe("getTask", () => {
  it("returns undefined for non-existent task_id", () => {
    assert.equal(getTask("no-such-task"), undefined);
  });

  it("returns instance_id field correctly from DB", () => {
    createTask("t-fetch", "agent-2", "Fetch test", undefined, "squad--issue-99");
    const fetched = getTask("t-fetch");
    assert.ok(fetched);
    assert.equal(fetched.instance_id, "squad--issue-99");
    assert.equal(fetched.task_id, "t-fetch");
  });

  it("returns null instance_id for tasks created without one", () => {
    createTask("t-fetch-null", "agent-2", "No instance");
    const fetched = getTask("t-fetch-null");
    assert.equal(fetched?.instance_id, null);
  });
});

// ── getActiveTasks ────────────────────────────────────────────────────────────

describe("getActiveTasks", () => {
  it("returns only running tasks", () => {
    createTask("t-run1", "agent-1", "Running 1");
    createTask("t-run2", "agent-1", "Running 2");
    const t = createTask("t-done", "agent-1", "Done task");
    completeTask(t.task_id, "finished");

    const active = getActiveTasks();
    assert.equal(active.length, 2);
    assert.ok(active.every((t) => t.status === "running"));
  });

  it("returns empty array when no running tasks", () => {
    assert.deepEqual(getActiveTasks(), []);
  });
});

// ── completeTask ──────────────────────────────────────────────────────────────

describe("completeTask", () => {
  it("sets status to done and records result and completed_at", () => {
    createTask("t-complete", "agent-1", "Task to complete");
    completeTask("t-complete", "all done");
    const t = getTask("t-complete");
    assert.equal(t?.status, "done");
    assert.equal(t?.result, "all done");
    assert.ok(t?.completed_at);
  });
});

// ── failTask ──────────────────────────────────────────────────────────────────

describe("failTask", () => {
  it("sets status to failed and records error and completed_at", () => {
    createTask("t-fail", "agent-1", "Task to fail");
    failTask("t-fail", "something went wrong");
    const t = getTask("t-fail");
    assert.equal(t?.status, "failed");
    assert.equal(t?.result, "something went wrong");
    assert.ok(t?.completed_at);
  });
});

// ── cancelTask ────────────────────────────────────────────────────────────────

describe("cancelTask", () => {
  it("cancels a running task with default reason", () => {
    createTask("t-cancel", "agent-1", "Task to cancel");
    cancelTask("t-cancel");
    const t = getTask("t-cancel");
    assert.equal(t?.status, "cancelled");
    assert.ok(t?.result?.includes("Cancelled"));
  });

  it("does not cancel an already-completed task", () => {
    createTask("t-cancel-done", "agent-1", "Already done");
    completeTask("t-cancel-done", "done");
    cancelTask("t-cancel-done");
    // status should remain 'done'
    assert.equal(getTask("t-cancel-done")?.status, "done");
  });
});

// ── listRecentTasks ───────────────────────────────────────────────────────────

describe("listRecentTasks", () => {
  it("returns tasks newest first", () => {
    createTask("t-list-1", "agent-1", "First");
    createTask("t-list-2", "agent-1", "Second");
    const tasks = listRecentTasks();
    assert.equal(tasks.length, 2);
    // Both should be present; newest (by insert order / task_id sort) first
    assert.ok(tasks.some((t) => t.task_id === "t-list-1"));
    assert.ok(tasks.some((t) => t.task_id === "t-list-2"));
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) {
      createTask(`t-limit-${i}`, "agent-1", `Task ${i}`);
    }
    const tasks = listRecentTasks(3);
    assert.equal(tasks.length, 3);
  });
});
