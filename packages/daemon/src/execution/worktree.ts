import { exec } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const DEFAULT_REMOTE = "origin";
const EXEC_OPTIONS = { maxBuffer: 10 * 1024 * 1024 };

export interface WorktreeInfo {
	path: string;
	branch: string | null;
	head: string | null;
	bare: boolean;
	detached: boolean;
	locked: boolean;
	prunable: boolean;
}

function sanitizeBranchName(branchName: string): string {
	return branchName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function runGit(command: string, cwd: string): Promise<string> {
	const { stdout } = await execAsync(command, {
		cwd,
		...EXEC_OPTIONS,
	});
	return stdout.trim();
}

async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
	const output = await runGit(`git branch --list ${JSON.stringify(branchName)}`, repoPath);
	return output.length > 0;
}

export function getWorktreePath(repoPath: string, branchName: string): string {
	return join(repoPath, ".worktrees", sanitizeBranchName(branchName));
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
	const output = await runGit("git worktree list --porcelain", repoPath);
	if (!output) {
		return [];
	}

	const blocks = output.split(/\r?\n\r?\n/).filter(Boolean);
	return blocks.map((block) => {
		const info: WorktreeInfo = {
			path: "",
			branch: null,
			head: null,
			bare: false,
			detached: false,
			locked: false,
			prunable: false,
		};

		for (const line of block.split(/\r?\n/)) {
			const [key, ...rest] = line.split(" ");
			const value = rest.join(" ").trim();
			switch (key) {
				case "worktree":
					info.path = value;
					break;
				case "branch":
					info.branch = value.replace(/^refs\/heads\//, "");
					break;
				case "HEAD":
					info.head = value;
					break;
				case "bare":
					info.bare = true;
					break;
				case "detached":
					info.detached = true;
					break;
				case "locked":
					info.locked = true;
					break;
				case "prunable":
					info.prunable = true;
					break;
			}
		}

		return info;
	});
}

export async function createWorktree(
	repoPath: string,
	branchName: string,
	baseBranch?: string,
): Promise<string> {
	const worktreePath = getWorktreePath(repoPath, branchName);
	await mkdir(join(repoPath, ".worktrees"), { recursive: true });

	const existing = (await listWorktrees(repoPath)).find(
		(worktree) => worktree.path === worktreePath,
	);
	if (existing) {
		return worktreePath;
	}

	const startPoint = baseBranch?.trim();
	const createNewBranch = !(await branchExists(repoPath, branchName));
	const command = createNewBranch
		? `git worktree add ${JSON.stringify(worktreePath)} -b ${JSON.stringify(branchName)}${startPoint ? ` ${JSON.stringify(startPoint)}` : ""}`
		: `git worktree add ${JSON.stringify(worktreePath)} ${JSON.stringify(branchName)}`;

	try {
		await runGit(command, repoPath);
		return worktreePath;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (/already exists/i.test(message)) {
			return worktreePath;
		}

		throw new Error(`Failed to create worktree for ${branchName}: ${message}`);
	}
}

export async function cleanupWorktree(worktreePath: string): Promise<void> {
	const parentRepoPath = join(worktreePath, "..", "..");
	try {
		await runGit(`git worktree remove ${JSON.stringify(worktreePath)}`, parentRepoPath);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!/not a working tree/i.test(message) && !/does not exist/i.test(message)) {
			await runGit(
				`git worktree remove --force ${JSON.stringify(worktreePath)}`,
				parentRepoPath,
			).catch(() => undefined);
		}
	}

	await runGit("git worktree prune", parentRepoPath).catch(() => undefined);
	await rm(worktreePath, { recursive: true, force: true }).catch(() => undefined);
}

export async function pushBranch(
	worktreePath: string,
	remote = DEFAULT_REMOTE,
): Promise<{ branchName: string; remote: string; output: string }> {
	const branchName = await runGit("git branch --show-current", worktreePath);
	if (!branchName) {
		throw new Error(`Unable to determine branch for worktree ${worktreePath}`);
	}

	const output = await runGit(
		`git push --set-upstream ${JSON.stringify(remote)} ${JSON.stringify(branchName)}`,
		worktreePath,
	);

	return { branchName, remote, output };
}
