/**
 * Tests for src/store/instances.ts — squad instances store.
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
import {
  createInstance,
  getInstance,
  listInstances,
  updateInstanceStatus,
  logInstanceDecision,
  getInstanceDecisions,
  mergeInstanceDecisions,
  deleteInstance,
  buildContextSnapshot,
  reconcileInstances,
  MAX_CONCURRENT_INSTANCES,
} from "./instances.js";
import { logDecision, getDecisions } from "./squads.js";

// ── DB isolation ─────────────────────────────────────────────────────────────

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-instances-test-"));
  setDbPathForTests(join(tmpDir, "io.db"));
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM instance_decisions").run();
  db.prepare("DELETE FROM squad_instances").run();
  db.prepare("DELETE FROM squad_decisions").run();
  db.prepare("DELETE FROM squads").run();
  db.prepare("INSERT INTO squads (slug, name, project_path) VALUES (?, ?, ?)").run("test-squad", "Test Squad", "/tmp/test");
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeInstance(id: string, slug = "test-squad", status?: string) {
  const inst = createInstance({
    id,
    masterSquadSlug: slug,
    issueRef: `#${id}`,
    worktreePath: `/tmp/nonexistent-worktree-${id}`,
    branchName: `${slug}/instance/${id}`,
  });
  if (status && status !== "pending") {
    updateInstanceStatus(id, status);
  }
  return inst;
}

// ── createInstance ────────────────────────────────────────────────────────────

describe("createInstance", () => {
  it("creates and returns an instance with correct fields", () => {
    const inst = createInstance({
      id: "inst-1",
      masterSquadSlug: "test-squad",
      issueRef: "#42",
      worktreePath: "/tmp/wt/inst-1",
      branchName: "test-squad/instance/inst-1",
      contextSnapshot: JSON.stringify([{ decision: "use TypeScript" }]),
    });
    assert.equal(inst.id, "inst-1");
    assert.equal(inst.master_squad_slug, "test-squad");
    assert.equal(inst.issue_ref, "#42");
    assert.equal(inst.worktree_path, "/tmp/wt/inst-1");
    assert.equal(inst.branch_name, "test-squad/instance/inst-1");
    assert.equal(inst.status, "pending");
    assert.ok(inst.context_snapshot?.includes("use TypeScript"));
    assert.equal(inst.completed_at, null);
    assert.ok(inst.created_at);
  });

  it("throws when max concurrent instances are exceeded", () => {
    // Create MAX_CONCURRENT_INSTANCES active instances
    for (let i = 1; i <= MAX_CONCURRENT_INSTANCES; i++) {
      createInstance({
        id: `inst-max-${i}`,
        masterSquadSlug: "test-squad",
        worktreePath: `/tmp/wt/inst-max-${i}`,
        branchName: `test-squad/instance/inst-max-${i}`,
      });
    }
    assert.throws(
      () =>
        createInstance({
          id: "inst-over-limit",
          masterSquadSlug: "test-squad",
          worktreePath: "/tmp/wt/inst-over-limit",
          branchName: "test-squad/instance/inst-over-limit",
        }),
      /Max concurrent instances/,
    );
  });

  it("does not count done/failed instances toward the limit", () => {
    for (let i = 1; i <= MAX_CONCURRENT_INSTANCES; i++) {
      const inst = createInstance({
        id: `inst-done-${i}`,
        masterSquadSlug: "test-squad",
        worktreePath: `/tmp/wt/inst-done-${i}`,
        branchName: `test-squad/instance/inst-done-${i}`,
      });
      updateInstanceStatus(inst.id, "done");
    }
    // Should not throw — all prior instances are done
    assert.doesNotThrow(() =>
      createInstance({
        id: "inst-after-done",
        masterSquadSlug: "test-squad",
        worktreePath: "/tmp/wt/inst-after-done",
        branchName: "test-squad/instance/inst-after-done",
      }),
    );
  });
});

// ── getInstance ───────────────────────────────────────────────────────────────

describe("getInstance", () => {
  it("returns undefined for non-existent ID", () => {
    assert.equal(getInstance("no-such-id"), undefined);
  });

  it("returns the correct instance after create", () => {
    makeInstance("get-test");
    const inst = getInstance("get-test");
    assert.ok(inst);
    assert.equal(inst.id, "get-test");
  });
});

// ── listInstances ─────────────────────────────────────────────────────────────

describe("listInstances", () => {
  it("filters by slug and excludes done/failed by default", () => {
    makeInstance("li-active-1");
    makeInstance("li-active-2");
    makeInstance("li-done", "test-squad", "done");
    makeInstance("li-failed", "test-squad", "failed");

    const active = listInstances("test-squad");
    assert.equal(active.length, 2);
    assert.ok(active.every((i) => i.status === "pending"));
  });

  it("includes completed instances when opted in", () => {
    makeInstance("li-pending");
    makeInstance("li-done2", "test-squad", "done");

    const all = listInstances("test-squad", { includeCompleted: true });
    assert.equal(all.length, 2);
  });

  it("does not include instances from other squads", () => {
    getDb().prepare("INSERT INTO squads (slug, name, project_path) VALUES (?, ?, ?)").run("other-squad", "Other", "/tmp/other");
    makeInstance("li-other", "other-squad");
    makeInstance("li-mine");

    const mine = listInstances("test-squad");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].id, "li-mine");
  });
});

// ── updateInstanceStatus ──────────────────────────────────────────────────────

describe("updateInstanceStatus", () => {
  it("sets completed_at for terminal status 'done'", () => {
    makeInstance("upd-done");
    updateInstanceStatus("upd-done", "done");
    const inst = getInstance("upd-done")!;
    assert.equal(inst.status, "done");
    assert.ok(inst.completed_at !== null);
  });

  it("sets completed_at for terminal status 'failed'", () => {
    makeInstance("upd-failed");
    updateInstanceStatus("upd-failed", "failed");
    const inst = getInstance("upd-failed")!;
    assert.equal(inst.status, "failed");
    assert.ok(inst.completed_at !== null);
  });

  it("does not set completed_at for non-terminal status 'active'", () => {
    makeInstance("upd-active");
    updateInstanceStatus("upd-active", "active");
    const inst = getInstance("upd-active")!;
    assert.equal(inst.status, "active");
    assert.equal(inst.completed_at, null);
  });
});

// ── logInstanceDecision + getInstanceDecisions ────────────────────────────────

describe("logInstanceDecision / getInstanceDecisions", () => {
  it("round-trips a decision with context", () => {
    makeInstance("dec-inst");
    logInstanceDecision("dec-inst", "use Jest for tests", "better DX");
    const decisions = getInstanceDecisions("dec-inst");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].decision, "use Jest for tests");
    assert.equal(decisions[0].context, "better DX");
    assert.equal(decisions[0].merged_to_master, 0);
  });

  it("stores null context when not provided", () => {
    makeInstance("dec-nocontext");
    logInstanceDecision("dec-nocontext", "some decision");
    const decisions = getInstanceDecisions("dec-nocontext");
    assert.equal(decisions[0].context, null);
  });

  it("returns decisions in ascending created_at order", () => {
    makeInstance("dec-order");
    logInstanceDecision("dec-order", "first");
    logInstanceDecision("dec-order", "second");
    const decisions = getInstanceDecisions("dec-order");
    assert.equal(decisions[0].decision, "first");
    assert.equal(decisions[1].decision, "second");
  });
});

// ── mergeInstanceDecisions ────────────────────────────────────────────────────

describe("mergeInstanceDecisions", () => {
  it("copies decisions to squad_decisions with provenance tag and marks merged", () => {
    makeInstance("merge-inst");
    logInstanceDecision("merge-inst", "use SQLite transactions", "performance");
    logInstanceDecision("merge-inst", "append-only log", "conflict-free");

    const count = mergeInstanceDecisions("merge-inst", "test-squad");
    assert.equal(count, 2);

    const masterDecisions = getDecisions("test-squad");
    assert.equal(masterDecisions.length, 2);
    assert.ok(masterDecisions.some((d) => d.decision === "use SQLite transactions"));
    assert.ok(masterDecisions.every((d) => d.context?.includes("[from instance: merge-inst]")));

    const instDecisions = getInstanceDecisions("merge-inst");
    assert.ok(instDecisions.every((d) => d.merged_to_master === 1));
  });

  it("is idempotent — calling twice does not double-merge", () => {
    makeInstance("merge-idempotent");
    logInstanceDecision("merge-idempotent", "idempotent decision");

    mergeInstanceDecisions("merge-idempotent", "test-squad");
    const second = mergeInstanceDecisions("merge-idempotent", "test-squad");
    assert.equal(second, 0);

    const masterDecisions = getDecisions("test-squad");
    assert.equal(masterDecisions.length, 1);
  });

  it("returns 0 when there are no decisions to merge", () => {
    makeInstance("merge-empty");
    const count = mergeInstanceDecisions("merge-empty", "test-squad");
    assert.equal(count, 0);
  });
});

// ── deleteInstance ────────────────────────────────────────────────────────────

describe("deleteInstance", () => {
  it("removes the instance and its decisions", () => {
    makeInstance("del-inst");
    logInstanceDecision("del-inst", "a decision");

    deleteInstance("del-inst");

    assert.equal(getInstance("del-inst"), undefined);
    assert.deepEqual(getInstanceDecisions("del-inst"), []);
  });

  it("is safe to call on a non-existent id", () => {
    assert.doesNotThrow(() => deleteInstance("no-such-instance"));
  });
});

// ── buildContextSnapshot ──────────────────────────────────────────────────────

describe("buildContextSnapshot", () => {
  it("returns a JSON array of recent squad decisions", () => {
    logDecision("test-squad", "use TypeScript everywhere", "consistency");
    logDecision("test-squad", "prefer functional style");

    const snapshot = buildContextSnapshot("test-squad");
    const parsed = JSON.parse(snapshot) as Array<{ decision: string; context: string | null; created_at: string }>;

    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 2);
    assert.ok(parsed.some((d) => d.decision === "use TypeScript everywhere"));
  });

  it("returns an empty JSON array for a squad with no decisions", () => {
    const snapshot = buildContextSnapshot("test-squad");
    assert.deepEqual(JSON.parse(snapshot), []);
  });

  it("respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      logDecision("test-squad", `decision ${i}`);
    }
    const snapshot = buildContextSnapshot("test-squad", 5);
    const parsed = JSON.parse(snapshot) as unknown[];
    assert.equal(parsed.length, 5);
  });
});

// ── reconcileInstances ────────────────────────────────────────────────────────

describe("reconcileInstances", () => {
  it("marks pending/active/merging instances failed when worktree does not exist", () => {
    // These worktree paths do not exist on disk
    makeInstance("recon-pending");                        // status: pending
    makeInstance("recon-active", "test-squad", "active"); // status: active
    makeInstance("recon-merging", "test-squad", "merging"); // status: merging

    const cleaned = reconcileInstances();
    assert.equal(cleaned, 3);

    assert.equal(getInstance("recon-pending")!.status, "failed");
    assert.equal(getInstance("recon-active")!.status, "failed");
    assert.equal(getInstance("recon-merging")!.status, "failed");
  });

  it("does not touch already-terminal instances", () => {
    makeInstance("recon-done", "test-squad", "done");
    makeInstance("recon-failed", "test-squad", "failed");

    const cleaned = reconcileInstances();
    assert.equal(cleaned, 0);
  });

  it("returns 0 when all non-terminal instances have valid worktrees", () => {
    // Use a path that actually exists (tmpDir was created above)
    createInstance({
      id: "recon-exists",
      masterSquadSlug: "test-squad",
      worktreePath: tmpDir, // this path exists on disk
      branchName: "test-squad/instance/recon-exists",
    });

    const cleaned = reconcileInstances();
    assert.equal(cleaned, 0);
    assert.equal(getInstance("recon-exists")!.status, "pending");
  });
});
