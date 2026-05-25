import { getDb } from "./db.js";
import { getDecisions } from "./squads.js";
import { worktreeExists } from "./worktrees.js";
import { readSquadWikiPages } from "../wiki/fs.js";

export interface SquadInstance {
  id: string;
  master_squad_slug: string;
  issue_ref: string | null;
  worktree_path: string;
  branch_name: string;
  status: string;
  context_snapshot: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface InstanceDecision {
  decision: string;
  context: string | null;
  created_at: string;
  merged_to_master: number;
}

export function ensureInstanceTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS squad_instances (
      id TEXT PRIMARY KEY,
      master_squad_slug TEXT NOT NULL,
      issue_ref TEXT,
      worktree_path TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      context_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS instance_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      context TEXT,
      merged_to_master INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export const MAX_CONCURRENT_INSTANCES = 3;

export function createInstance(input: {
  id: string;
  masterSquadSlug: string;
  issueRef?: string;
  worktreePath: string;
  branchName: string;
  contextSnapshot?: string;
}): SquadInstance {
  const db = getDb();
  const activeCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM squad_instances WHERE master_squad_slug = ? AND status NOT IN ('done', 'failed')")
      .get(input.masterSquadSlug) as { cnt: number }
  ).cnt;
  if (activeCount >= MAX_CONCURRENT_INSTANCES) {
    throw new Error(`Max concurrent instances (${MAX_CONCURRENT_INSTANCES}) reached for squad "${input.masterSquadSlug}"`);
  }
  db.prepare(
    `INSERT INTO squad_instances (id, master_squad_slug, issue_ref, worktree_path, branch_name, status, context_snapshot)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    input.id,
    input.masterSquadSlug,
    input.issueRef ?? null,
    input.worktreePath,
    input.branchName,
    input.contextSnapshot ?? null,
  );
  return getInstance(input.id)!;
}

export function getInstance(id: string): SquadInstance | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM squad_instances WHERE id = ?").get(id) as SquadInstance | undefined;
}

export function listInstances(
  masterSquadSlug: string,
  opts?: { includeCompleted?: boolean },
): Array<{ id: string; issue_ref: string | null; status: string; branch_name: string; created_at: string; completed_at: string | null }> {
  const db = getDb();
  const includeCompleted = opts?.includeCompleted ?? false;
  if (includeCompleted) {
    return db
      .prepare("SELECT id, issue_ref, status, branch_name, created_at, completed_at FROM squad_instances WHERE master_squad_slug = ? ORDER BY created_at DESC")
      .all(masterSquadSlug) as Array<{ id: string; issue_ref: string | null; status: string; branch_name: string; created_at: string; completed_at: string | null }>;
  }
  return db
    .prepare("SELECT id, issue_ref, status, branch_name, created_at, completed_at FROM squad_instances WHERE master_squad_slug = ? AND status NOT IN ('done', 'failed') ORDER BY created_at DESC")
    .all(masterSquadSlug) as Array<{ id: string; issue_ref: string | null; status: string; branch_name: string; created_at: string; completed_at: string | null }>;
}

export function updateInstanceStatus(id: string, status: string): void {
  const db = getDb();
  if (status === "done" || status === "failed") {
    db.prepare("UPDATE squad_instances SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
  } else {
    db.prepare("UPDATE squad_instances SET status = ? WHERE id = ?").run(status, id);
  }
}

export function logInstanceDecision(instanceId: string, decision: string, context?: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO instance_decisions (instance_id, decision, context) VALUES (?, ?, ?)",
  ).run(instanceId, decision, context ?? null);
}

export function getInstanceDecisions(instanceId: string): InstanceDecision[] {
  const db = getDb();
  return db
    .prepare("SELECT decision, context, created_at, merged_to_master FROM instance_decisions WHERE instance_id = ? ORDER BY created_at ASC")
    .all(instanceId) as InstanceDecision[];
}

/**
 * Merge instance decisions back to master squad. Returns count merged.
 */
export function mergeInstanceDecisions(instanceId: string, masterSquadSlug: string): number {
  const db = getDb();
  const decisions = db
    .prepare("SELECT id, decision, context FROM instance_decisions WHERE instance_id = ? AND merged_to_master = 0")
    .all(instanceId) as Array<{ id: number; decision: string; context: string | null }>;

  if (decisions.length === 0) return 0;

  const insertStmt = db.prepare(
    "INSERT INTO squad_decisions (squad_slug, decision, context) VALUES (?, ?, ?)",
  );
  const markStmt = db.prepare(
    "UPDATE instance_decisions SET merged_to_master = 1 WHERE id = ?",
  );

  const mergeAll = db.transaction(() => {
    for (const d of decisions) {
      const ctx = d.context
        ? `${d.context} [from instance: ${instanceId}]`
        : `[from instance: ${instanceId}]`;
      insertStmt.run(masterSquadSlug, d.decision, ctx);
      markStmt.run(d.id);
    }
  });

  mergeAll();
  return decisions.length;
}

export function deleteInstance(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM instance_decisions WHERE instance_id = ?").run(id);
  db.prepare("DELETE FROM squad_instances WHERE id = ?").run(id);
}

/**
 * Build a JSON snapshot of the master squad's recent decisions for context inheritance.
 */
export function buildContextSnapshot(masterSquadSlug: string, limit: number = 30): string {
  const decisions = getDecisions(masterSquadSlug, limit);
  const wikiPages = readSquadWikiPages(masterSquadSlug);

  const snapshot: Record<string, unknown> = {
    decisions: decisions.map((d) => ({ decision: d.decision, context: d.context, created_at: d.created_at })),
  };

  if (wikiPages.length > 0) {
    snapshot.wiki = wikiPages.map(p => ({ path: p.path, content: p.content }));
  }

  return JSON.stringify(snapshot);
}

/**
 * Reconcile instances on startup: detect orphaned worktrees and mark stale active instances.
 * Returns the number of instances cleaned up.
 */
export function reconcileInstances(): number {
  const db = getDb();
  const activeInstances = db
    .prepare("SELECT id, worktree_path FROM squad_instances WHERE status IN ('active', 'pending', 'merging')")
    .all() as Array<{ id: string; worktree_path: string }>;

  let cleaned = 0;
  for (const inst of activeInstances) {
    if (!worktreeExists(inst.worktree_path)) {
      updateInstanceStatus(inst.id, "failed");
      cleaned++;
    }
  }
  return cleaned;
}
