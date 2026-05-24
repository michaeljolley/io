/**
 * Tests for auto-deactivation of activeInstanceId on instance complete/abort.
 * Exercises the squad_instance_complete and squad_instance_abort tool handlers.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createTools, type ToolDeps } from "./tools.js";

// Minimal mock deps sufficient to test the instance tools
function makeMockDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  const instances: Record<string, { id: string; master_squad_slug: string; issue_ref: string | null; worktree_path: string; branch_name: string; status: string; context_snapshot: string | null; created_at: string; completed_at: string | null }> = {};

  const base: ToolDeps = {
    wikiRead: () => undefined,
    wikiWrite: () => {},
    wikiSearch: () => [],
    wikiAssertPagePath: () => {},
    wikiDelete: () => false,
    wikiList: () => [],
    getSquad: () => ({ slug: "test", name: "Test", projectPath: "/tmp/test", status: "idle" }),
    listSquads: () => [],
    createSquad: () => {},
    deleteSquad: () => {},
    logDecision: () => {},
    getDecisionsSummary: () => "",
    getRecentDecisions: () => [],
    updateSquadStatus: () => {},
    delegateToAgent: async () => "task-1",
    getTask: () => undefined,
    getActiveAgentTasks: () => [],
    addSquadAgent: () => ({ character_name: "A", role_title: "R", personality: null, model_tier: "medium" }),
    listSquadAgents: () => [],
    getAgentTaskStats: () => [],
    getStalestSpecialist: () => null,
    removeSquadAgent: () => false,
    resetSquadAgent: () => ({ found: false, previousStatus: "", agent: null }),
    setSquadLead: () => {},
    getSquadLead: () => undefined,
    setSquadQA: () => {},
    getTaskReviews: () => [],
    getSquadWorkDistribution: () => ({ total: 0, perAgent: [] }),
    listSkills: () => [],
    installSkill: async () => ({ name: "", slug: "", description: "", path: "" }),
    removeSkill: () => false,
    searchSkillsRegistry: async () => [],
    saveConfig: () => {},
    checkForUpdate: async () => ({ updateAvailable: false, current: "1.0.0", latest: "1.0.0" }),
    // Instance deps
    createInstance: (input) => {
      const inst = { id: input.id, master_squad_slug: input.masterSquadSlug, status: "pending", worktree_path: input.worktreePath, branch_name: input.branchName, issue_ref: null, context_snapshot: null, created_at: new Date().toISOString(), completed_at: null };
      instances[input.id] = inst;
      return inst;
    },
    getInstance: (id) => instances[id],
    listInstances: () => [],
    updateInstanceStatus: (id, status) => { if (instances[id]) instances[id].status = status; },
    logInstanceDecision: () => {},
    getInstanceDecisions: () => [],
    mergeInstanceDecisions: () => 0,
    deleteInstance: (id) => { delete instances[id]; },
    buildContextSnapshot: () => "[]",
    reconcileInstances: () => 0,
    createWorktree: () => "/tmp/wt",
    removeWorktree: () => {},
    activeInstanceId: undefined,
    ...overrides,
  };

  // Pre-seed an instance for tests
  instances["test-squad--issue-1"] = {
    id: "test-squad--issue-1",
    master_squad_slug: "test",
    issue_ref: "#1",
    worktree_path: "/tmp/wt/test-squad--issue-1",
    branch_name: "test/instance/issue-1",
    status: "active",
    context_snapshot: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };

  return base;
}

function findToolHandler(tools: ReturnType<typeof createTools>, name: string): (args: any, inv?: any) => Promise<any> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool.handler as any;
}

describe("auto-deactivate activeInstanceId", () => {
  let deps: ToolDeps;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    deps = makeMockDeps();
    tools = createTools(deps);
  });

  it("completing an active instance auto-deactivates it", async () => {
    deps.activeInstanceId = "test-squad--issue-1";
    const handler = findToolHandler(tools, "squad_instance_complete");
    await handler({ instance_id: "test-squad--issue-1" });

    assert.strictEqual(deps.activeInstanceId, undefined);
  });

  it("aborting an active instance auto-deactivates it", async () => {
    deps.activeInstanceId = "test-squad--issue-1";
    const handler = findToolHandler(tools, "squad_instance_abort");
    await handler({ instance_id: "test-squad--issue-1" });

    assert.strictEqual(deps.activeInstanceId, undefined);
  });

  it("completing a non-active instance does NOT change activeInstanceId", async () => {
    deps.activeInstanceId = "some-other-instance";
    const handler = findToolHandler(tools, "squad_instance_complete");
    await handler({ instance_id: "test-squad--issue-1" });

    assert.strictEqual(deps.activeInstanceId, "some-other-instance");
  });

  it("aborting a non-active instance does NOT change activeInstanceId", async () => {
    deps.activeInstanceId = "some-other-instance";
    const handler = findToolHandler(tools, "squad_instance_abort");
    await handler({ instance_id: "test-squad--issue-1" });

    assert.strictEqual(deps.activeInstanceId, "some-other-instance");
  });
});
