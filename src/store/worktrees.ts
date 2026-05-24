import { execSync } from "child_process";
import { existsSync, rmSync, mkdirSync } from "fs";
import path from "path";

export interface WorktreeInfo {
  path: string;
  branch: string;
}

/**
 * Create a git worktree for a squad instance.
 * @param projectPath - The main project directory (must be a git repo)
 * @param instanceId - Used to name the worktree subdirectory
 * @param branchName - The branch to create for this worktree
 * @param baseBranch - The branch to base the worktree on (default: "main")
 * @returns The absolute path to the created worktree
 */
export function createWorktree(
  projectPath: string,
  instanceId: string,
  branchName: string,
  baseBranch: string = "main",
): string {
  const worktreeDir = path.join(projectPath, ".io-worktrees", instanceId);

  const parentDir = path.join(projectPath, ".io-worktrees");
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Fetch latest to ensure base branch is up to date
  try {
    execSync(`git fetch origin ${baseBranch}`, { cwd: projectPath, stdio: "pipe" });
  } catch {
    // Best effort — might be offline or no remote
  }

  // Create the worktree with a new branch from the base
  execSync(
    `git worktree add "${worktreeDir}" -b "${branchName}" "origin/${baseBranch}"`,
    { cwd: projectPath, stdio: "pipe" },
  );

  return worktreeDir;
}

/**
 * Remove a git worktree. Falls back to rm -rf + prune if git remove fails.
 */
export function removeWorktree(projectPath: string, worktreePath: string): void {
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: projectPath,
      stdio: "pipe",
    });
  } catch {
    // Fallback: force remove directory and prune
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }
    try {
      execSync("git worktree prune", { cwd: projectPath, stdio: "pipe" });
    } catch {
      // best effort
    }
  }
}

/**
 * List all worktrees for a project.
 */
export function listWorktrees(projectPath: string): WorktreeInfo[] {
  try {
    const output = execSync("git worktree list --porcelain", {
      cwd: projectPath,
      encoding: "utf-8",
    });
    const entries: WorktreeInfo[] = [];
    let currentPath = "";
    for (const line of output.split("\n")) {
      if (line.startsWith("worktree ")) {
        currentPath = line.slice("worktree ".length);
      } else if (line.startsWith("branch ")) {
        entries.push({ path: currentPath, branch: line.slice("branch refs/heads/".length) });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Check if a worktree path exists on disk.
 */
export function worktreeExists(worktreePath: string): boolean {
  return existsSync(worktreePath);
}
