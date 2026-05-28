import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getDb } from "./db.js";

const execAsync = promisify(exec);

export interface Instance {
  id: string;
  squad_id: string;
  branch: string;
  worktree_path: string;
  status: string;
  last_activity: string;
  created_at: string;
}

const MAX_INSTANCES_PER_SQUAD = 3;

export function getInstance(instanceId: string): Instance | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM instances WHERE id = ?").get(instanceId) as Instance | undefined;
}

export async function createInstance(
  squadId: string,
  branch: string
): Promise<Instance> {
  const db = getDb();

  // Check max instances
  const active = db
    .prepare(
      "SELECT COUNT(*) as count FROM instances WHERE squad_id = ? AND status = 'active'"
    )
    .get(squadId) as { count: number };

  if (active.count >= MAX_INSTANCES_PER_SQUAD) {
    throw new Error(
      `Squad already has ${MAX_INSTANCES_PER_SQUAD} active instances. Destroy one first.`
    );
  }

  // Get squad repo to determine worktree location
  const squad = db.prepare("SELECT * FROM squads WHERE id = ?").get(squadId) as any;
  if (!squad?.repo_url) {
    throw new Error("Squad has no repo_url configured.");
  }

  const id = randomUUID();
  const worktreePath = `/tmp/io-worktrees/${squadId}/${branch}`;

  // Create git worktree
  const repoCwd = squad.repo_url.startsWith("/") ? squad.repo_url : process.cwd();
  try {
    await execAsync(`git worktree add ${worktreePath} -b ${branch}`, { cwd: repoCwd });
  } catch {
    // Branch may already exist
    await execAsync(`git worktree add ${worktreePath} ${branch}`, { cwd: repoCwd });
  }

  db.prepare(
    `INSERT INTO instances (id, squad_id, branch, worktree_path, status)
     VALUES (?, ?, ?, ?, 'active')`
  ).run(id, squadId, branch, worktreePath);

  return db.prepare("SELECT * FROM instances WHERE id = ?").get(id) as Instance;
}

export async function destroyInstance(instanceId: string): Promise<void> {
  const db = getDb();
  const instance = db
    .prepare("SELECT * FROM instances WHERE id = ?")
    .get(instanceId) as Instance | undefined;

  if (!instance) throw new Error(`Instance ${instanceId} not found.`);

  // Remove worktree
  try {
    await execAsync(`git worktree remove ${instance.worktree_path} --force`);
  } catch {
    // Already removed or doesn't exist
  }

  db.prepare("UPDATE instances SET status = 'destroyed' WHERE id = ?").run(instanceId);
}

export function getInstancesForSquad(squadId: string): Instance[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM instances WHERE squad_id = ? AND status = 'active' ORDER BY created_at")
    .all(squadId) as Instance[];
}

export function touchInstanceActivity(instanceId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE instances SET last_activity = datetime('now') WHERE id = ?"
  ).run(instanceId);
}

export function getStaleInstances(minutesThreshold: number = 30): Instance[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM instances WHERE status = 'active'
       AND datetime(last_activity, '+${minutesThreshold} minutes') < datetime('now')`
    )
    .all() as Instance[];
}
