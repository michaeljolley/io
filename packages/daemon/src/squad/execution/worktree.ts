import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../../logging/logger.js';

const logger = () => createChildLogger('worktree');

export interface WorktreeInfo {
	path: string;
	branch: string;
}

/**
 * Create a git worktree for an instance.
 * Branch naming: io/{squad-name}/{short-id}
 */
export function createWorktree(params: {
	repoPath: string;
	squadName: string;
	instanceId: string;
}): WorktreeInfo {
	const log = logger();
	const shortId = params.instanceId.slice(0, 8);
	const branch = `io/${params.squadName}/${shortId}`;
	const worktreePath = join(
		params.repoPath,
		'..',
		'.io-worktrees',
		`${params.squadName}-${shortId}`,
	);

	// Ensure the repo is a git repository
	if (!existsSync(join(params.repoPath, '.git'))) {
		throw new Error(`Not a git repository: ${params.repoPath}`);
	}

	// Create the worktree with a new branch from HEAD
	try {
		execSync(`git worktree add -b "${branch}" "${worktreePath}"`, {
			cwd: params.repoPath,
			stdio: 'pipe',
			encoding: 'utf-8',
		});
	} catch (err) {
		// Branch might already exist — try without -b
		try {
			execSync(`git worktree add "${worktreePath}" "${branch}"`, {
				cwd: params.repoPath,
				stdio: 'pipe',
				encoding: 'utf-8',
			});
		} catch (innerErr) {
			throw new Error(
				`Failed to create worktree: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`,
			);
		}
	}

	log.info({ worktreePath, branch }, 'Worktree created');
	return { path: worktreePath, branch };
}

/**
 * Remove a git worktree and delete its branch.
 */
export function removeWorktree(params: {
	repoPath: string;
	worktreePath: string;
	branch: string;
}): void {
	const log = logger();

	try {
		execSync(`git worktree remove "${params.worktreePath}" --force`, {
			cwd: params.repoPath,
			stdio: 'pipe',
			encoding: 'utf-8',
		});
	} catch {
		// Worktree might already be removed; try cleaning up the directory
		if (existsSync(params.worktreePath)) {
			rmSync(params.worktreePath, { recursive: true, force: true });
		}
		// Prune worktree references
		try {
			execSync('git worktree prune', { cwd: params.repoPath, stdio: 'pipe' });
		} catch {
			// ignore
		}
	}

	// Delete the branch
	try {
		execSync(`git branch -D "${params.branch}"`, {
			cwd: params.repoPath,
			stdio: 'pipe',
			encoding: 'utf-8',
		});
	} catch {
		// Branch might not exist or be checked out elsewhere
	}

	log.info({ branch: params.branch }, 'Worktree removed');
}

/**
 * List all IO-managed worktrees for a repository.
 */
export function listWorktrees(repoPath: string): WorktreeInfo[] {
	try {
		const output = execSync('git worktree list --porcelain', {
			cwd: repoPath,
			stdio: 'pipe',
			encoding: 'utf-8',
		});

		const worktrees: WorktreeInfo[] = [];
		const blocks = output.split('\n\n');

		for (const block of blocks) {
			const lines = block.trim().split('\n');
			const pathLine = lines.find((l) => l.startsWith('worktree '));
			const branchLine = lines.find((l) => l.startsWith('branch '));

			if (pathLine && branchLine) {
				const path = pathLine.replace('worktree ', '');
				const branch = branchLine.replace('branch refs/heads/', '');
				if (branch.startsWith('io/')) {
					worktrees.push({ path, branch });
				}
			}
		}

		return worktrees;
	} catch {
		return [];
	}
}
