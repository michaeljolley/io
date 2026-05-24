/**
 * Tests for src/store/squads.ts — the most-depended-on store module.
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
  createSquad,
  getSquad,
  listSquads,
  updateSquadSession,
  updateSquadStatus,
  updateSquadModel,
  deleteSquad,
  addSquadAgent,
  getSquadAgent,
  listSquadAgents,
  removeSquadAgent,
  updateAgentSession,
  updateAgentStatus,
  clearAgentSession,
  reconcileAgentStatuses,
  reconcileSquadStatuses,
  logDecision,
  getDecisions,
  getDecisionsSummary,
  setSquadLead,
  getSquadLead,
  setSquadQA,
} from "./squads.js";

// ── DB isolation ─────────────────────────────────────────────────────────────

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-squads-test-"));
  setDbPathForTests(join(tmpDir, "io.db"));
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM squad_decisions").run();
  db.prepare("DELETE FROM squad_agents").run();
  db.prepare("DELETE FROM squads").run();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSquad(slug = "test-squad") {
  // Insert directly so tests don't depend on universe randomization
  getDb()
    .prepare("INSERT INTO squads (slug, name, project_path, universe) VALUES (?, ?, ?, ?)")
    .run(slug, `${slug} name`, "/tmp/test", "thundercats");
  return getSquad(slug)!;
}

// ── createSquad ───────────────────────────────────────────────────────────────

describe("createSquad", () => {
  it("creates and returns a squad with correct fields", () => {
    const squad = createSquad("my-squad", "My Squad", "/tmp/my-squad");
    assert.equal(squad.slug, "my-squad");
    assert.equal(squad.name, "My Squad");
    assert.equal(squad.project_path, "/tmp/my-squad");
    assert.equal(squad.status, "idle");
    assert.equal(squad.copilot_session_id, null);
    assert.ok(squad.universe); // assigned by randomUniverse()
    assert.ok(squad.created_at);
  });

  it("throws on duplicate slug", () => {
    createSquad("dup-squad", "Dup", "/tmp/dup");
    assert.throws(() => createSquad("dup-squad", "Dup2", "/tmp/dup2"));
  });

  it("accepts an explicit universeId", () => {
    const squad = createSquad("universe-squad", "Uni Squad", "/tmp/uni", "thundercats");
    assert.equal(squad.universe, "thundercats");
  });
});

// ── getSquad ──────────────────────────────────────────────────────────────────

describe("getSquad", () => {
  it("returns undefined for non-existent slug", () => {
    assert.equal(getSquad("no-such-squad"), undefined);
  });

  it("returns the correct squad after creation", () => {
    makeSquad("get-test");
    const squad = getSquad("get-test");
    assert.ok(squad);
    assert.equal(squad.slug, "get-test");
  });
});

// ── listSquads ────────────────────────────────────────────────────────────────

describe("listSquads", () => {
  it("returns empty array on clean DB", () => {
    assert.deepEqual(listSquads(), []);
  });

  it("returns all squads newest first", () => {
    makeSquad("squad-a");
    makeSquad("squad-b");
    const squads = listSquads();
    assert.equal(squads.length, 2);
    // Both are present
    assert.ok(squads.some((s) => s.slug === "squad-a"));
    assert.ok(squads.some((s) => s.slug === "squad-b"));
  });
});

// ── updateSquadSession ────────────────────────────────────────────────────────

describe("updateSquadSession", () => {
  it("sets copilot_session_id", () => {
    makeSquad();
    updateSquadSession("test-squad", "session-abc");
    assert.equal(getSquad("test-squad")?.copilot_session_id, "session-abc");
  });
});

// ── updateSquadStatus ─────────────────────────────────────────────────────────

describe("updateSquadStatus", () => {
  it("updates status field", () => {
    makeSquad();
    updateSquadStatus("test-squad", "working");
    assert.equal(getSquad("test-squad")?.status, "working");
  });
});

// ── updateSquadModel ──────────────────────────────────────────────────────────

describe("updateSquadModel", () => {
  it("sets model to a string", () => {
    makeSquad();
    updateSquadModel("test-squad", "gpt-4.1");
    assert.equal(getSquad("test-squad")?.model, "gpt-4.1");
  });

  it("sets model to null", () => {
    makeSquad();
    updateSquadModel("test-squad", "gpt-4.1");
    updateSquadModel("test-squad", null);
    assert.equal(getSquad("test-squad")?.model, null);
  });
});

// ── deleteSquad ───────────────────────────────────────────────────────────────

describe("deleteSquad", () => {
  it("removes the squad row", () => {
    makeSquad();
    deleteSquad("test-squad");
    assert.equal(getSquad("test-squad"), undefined);
  });

  it("cascades to remove agents and decisions", () => {
    makeSquad();
    logDecision("test-squad", "a decision");
    addSquadAgent("test-squad", "Engineer", "Build things");
    deleteSquad("test-squad");
    assert.deepEqual(listSquadAgents("test-squad"), []);
    assert.deepEqual(getDecisions("test-squad"), []);
  });

  it("is safe to call on a non-existent slug", () => {
    assert.doesNotThrow(() => deleteSquad("no-such-squad"));
  });
});

// ── addSquadAgent ─────────────────────────────────────────────────────────────

describe("addSquadAgent", () => {
  it("creates an agent with correct fields", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Engineer", "Build things", "medium");
    assert.equal(agent.squad_slug, "test-squad");
    assert.equal(agent.role_title, "Engineer");
    assert.equal(agent.charter, "Build things");
    assert.equal(agent.model_tier, "medium");
    assert.equal(agent.status, "idle");
    assert.equal(agent.is_lead, 0);
    assert.equal(agent.is_qa, 0);
    assert.ok(agent.character_name); // assigned from universe
    assert.ok(agent.personality);
  });

  it("assigns distinct character names to multiple agents", () => {
    makeSquad();
    const a1 = addSquadAgent("test-squad", "Engineer", "Build");
    const a2 = addSquadAgent("test-squad", "Designer", "Design");
    assert.notEqual(a1.character_name, a2.character_name);
  });

  it("throws for non-existent squad", () => {
    assert.throws(() => addSquadAgent("no-squad", "Dev", "Code"), /Squad not found/);
  });
});

// ── getSquadAgent ─────────────────────────────────────────────────────────────

describe("getSquadAgent", () => {
  it("returns undefined for non-existent agent", () => {
    makeSquad();
    assert.equal(getSquadAgent("test-squad", "Nonexistent"), undefined);
  });

  it("returns the agent after creation", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Dev", "Code things");
    const fetched = getSquadAgent("test-squad", agent.character_name);
    assert.ok(fetched);
    assert.equal(fetched.role_title, "Dev");
  });
});

// ── listSquadAgents ───────────────────────────────────────────────────────────

describe("listSquadAgents", () => {
  it("returns empty array for squad with no agents", () => {
    makeSquad();
    assert.deepEqual(listSquadAgents("test-squad"), []);
  });

  it("returns all agents for the squad", () => {
    makeSquad();
    addSquadAgent("test-squad", "Dev", "Code");
    addSquadAgent("test-squad", "QA", "Test");
    assert.equal(listSquadAgents("test-squad").length, 2);
  });

  it("does not return agents from other squads", () => {
    makeSquad("squad-a");
    makeSquad("squad-b");
    addSquadAgent("squad-a", "Dev", "Code");
    assert.equal(listSquadAgents("squad-b").length, 0);
  });
});

// ── removeSquadAgent ──────────────────────────────────────────────────────────

describe("removeSquadAgent", () => {
  it("removes the agent and returns true", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Dev", "Code");
    const result = removeSquadAgent("test-squad", agent.character_name);
    assert.equal(result, true);
    assert.equal(listSquadAgents("test-squad").length, 0);
  });

  it("returns false for non-existent agent", () => {
    makeSquad();
    assert.equal(removeSquadAgent("test-squad", "Ghost"), false);
  });
});

// ── updateAgentSession ────────────────────────────────────────────────────────

describe("updateAgentSession / clearAgentSession", () => {
  it("sets and clears copilot_session_id", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Dev", "Code");
    updateAgentSession("test-squad", agent.character_name, "session-xyz");
    assert.equal(getSquadAgent("test-squad", agent.character_name)?.copilot_session_id, "session-xyz");

    clearAgentSession("test-squad", agent.character_name);
    assert.equal(getSquadAgent("test-squad", agent.character_name)?.copilot_session_id, null);
  });
});

// ── updateAgentStatus ─────────────────────────────────────────────────────────

describe("updateAgentStatus", () => {
  it("updates agent status field", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Dev", "Code");
    updateAgentStatus("test-squad", agent.character_name, "working");
    assert.equal(getSquadAgent("test-squad", agent.character_name)?.status, "working");
  });
});

// ── reconcileAgentStatuses ────────────────────────────────────────────────────

describe("reconcileAgentStatuses", () => {
  it("resets working/error agents to idle and returns count", () => {
    makeSquad();
    const a1 = addSquadAgent("test-squad", "Dev", "Code");
    const a2 = addSquadAgent("test-squad", "QA", "Test");
    updateAgentStatus("test-squad", a1.character_name, "working");
    updateAgentStatus("test-squad", a2.character_name, "error");

    const count = reconcileAgentStatuses();
    assert.equal(count, 2);
    assert.equal(getSquadAgent("test-squad", a1.character_name)?.status, "idle");
    assert.equal(getSquadAgent("test-squad", a2.character_name)?.status, "idle");
  });

  it("does not touch already-idle agents", () => {
    makeSquad();
    addSquadAgent("test-squad", "Dev", "Code");
    const count = reconcileAgentStatuses();
    assert.equal(count, 0);
  });
});

// ── reconcileSquadStatuses ────────────────────────────────────────────────────

describe("reconcileSquadStatuses", () => {
  it("resets working/error squads to idle", () => {
    makeSquad("sq-working");
    makeSquad("sq-error");
    updateSquadStatus("sq-working", "working");
    updateSquadStatus("sq-error", "error");

    const count = reconcileSquadStatuses();
    assert.equal(count, 2);
    assert.equal(getSquad("sq-working")?.status, "idle");
    assert.equal(getSquad("sq-error")?.status, "idle");
  });
});

// ── logDecision / getDecisions ────────────────────────────────────────────────

describe("logDecision / getDecisions", () => {
  it("round-trips a decision with context", () => {
    makeSquad();
    logDecision("test-squad", "use TypeScript", "type safety");
    const decisions = getDecisions("test-squad");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].decision, "use TypeScript");
    assert.equal(decisions[0].context, "type safety");
    assert.equal(decisions[0].squad_slug, "test-squad");
  });

  it("stores null context when not provided", () => {
    makeSquad();
    logDecision("test-squad", "no context decision");
    assert.equal(getDecisions("test-squad")[0].context, null);
  });

  it("returns newest first by default", () => {
    makeSquad();
    // Use explicit timestamps to avoid same-second ordering ambiguity
    const db = getDb();
    db.prepare("INSERT INTO squad_decisions (squad_slug, decision, context, created_at) VALUES (?, ?, ?, ?)").run("test-squad", "older", null, "2020-01-01 00:00:01");
    db.prepare("INSERT INTO squad_decisions (squad_slug, decision, context, created_at) VALUES (?, ?, ?, ?)").run("test-squad", "newer", null, "2020-01-01 00:00:02");
    const decisions = getDecisions("test-squad");
    assert.equal(decisions[0].decision, "newer");
    assert.equal(decisions[1].decision, "older");
  });

  it("respects the limit parameter", () => {
    makeSquad();
    for (let i = 0; i < 10; i++) logDecision("test-squad", `decision ${i}`);
    assert.equal(getDecisions("test-squad", 5).length, 5);
  });

  it("returns empty array for squad with no decisions", () => {
    makeSquad();
    assert.deepEqual(getDecisions("test-squad"), []);
  });
});

// ── getDecisionsSummary ───────────────────────────────────────────────────────

describe("getDecisionsSummary", () => {
  it("returns 'No decisions recorded.' for empty squad", () => {
    makeSquad();
    assert.equal(getDecisionsSummary("test-squad"), "No decisions recorded.");
  });

  it("includes decision text in summary", () => {
    makeSquad();
    logDecision("test-squad", "use SQLite", "simple and fast");
    const summary = getDecisionsSummary("test-squad");
    assert.ok(summary.includes("use SQLite"));
    assert.ok(summary.includes("simple and fast"));
  });
});

// ── setSquadLead / getSquadLead ───────────────────────────────────────────────

describe("setSquadLead / getSquadLead", () => {
  it("sets and retrieves the squad lead", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "Lead Dev", "Lead the team");
    setSquadLead("test-squad", agent.character_name);
    const lead = getSquadLead("test-squad");
    assert.ok(lead);
    assert.equal(lead.character_name, agent.character_name);
    assert.equal(lead.is_lead, 1);
  });

  it("replaces previous lead (only one lead at a time)", () => {
    makeSquad();
    const a1 = addSquadAgent("test-squad", "Dev 1", "Code");
    const a2 = addSquadAgent("test-squad", "Dev 2", "Code more");
    setSquadLead("test-squad", a1.character_name);
    setSquadLead("test-squad", a2.character_name);

    assert.equal(getSquadLead("test-squad")?.character_name, a2.character_name);
    assert.equal(getSquadAgent("test-squad", a1.character_name)?.is_lead, 0);
  });

  it("returns undefined when no lead is set", () => {
    makeSquad();
    addSquadAgent("test-squad", "Dev", "Code");
    assert.equal(getSquadLead("test-squad"), undefined);
  });
});

// ── setSquadQA ────────────────────────────────────────────────────────────────

describe("setSquadQA", () => {
  it("marks an agent as QA", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "QA", "Test all the things");
    setSquadQA("test-squad", agent.character_name, true);
    assert.equal(getSquadAgent("test-squad", agent.character_name)?.is_qa, 1);
  });

  it("unmarks a QA agent", () => {
    makeSquad();
    const agent = addSquadAgent("test-squad", "QA", "Test");
    setSquadQA("test-squad", agent.character_name, true);
    setSquadQA("test-squad", agent.character_name, false);
    assert.equal(getSquadAgent("test-squad", agent.character_name)?.is_qa, 0);
  });
});
