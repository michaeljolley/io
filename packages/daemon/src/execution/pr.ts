import { exec } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { Objective, PrMode } from "@io/shared";

import { pushBranch } from "./worktree.js";

const execAsync = promisify(exec);
const URL_PATTERN = /https?:\/\/\S+/i;

export interface PrOptions {
	repoPath: string;
	branchName: string;
	baseBranch: string;
	title: string;
	body: string;
	prMode: PrMode;
}

export interface PullRequestResult {
	prUrl?: string;
	merged?: boolean;
}

async function runCommand(command: string, cwd: string): Promise<string> {
	const { stdout } = await execAsync(command, {
		cwd,
		maxBuffer: 5 * 1024 * 1024,
	});
	return stdout.trim();
}

function extractUrl(output: string): string | undefined {
	return output.match(URL_PATTERN)?.[0];
}

function buildBodyFilePath(repoPath: string, branchName: string): string {
	const safeBranchName = branchName.replace(/[^a-zA-Z0-9._-]+/g, "-");
	return join(repoPath, `.io-pr-body-${safeBranchName}.md`);
}

export function buildPrBody(
	objective: Objective,
	plan: string,
	taskSummaries: string[],
	qaOutcome: { approved: boolean; feedback: string },
): string {
	const tasks =
		taskSummaries.map((summary) => `- ${summary}`).join("\n") || "- No task summaries recorded.";
	return [
		"## Objective",
		objective.description,
		"",
		"## Plan",
		plan || "No plan recorded.",
		"",
		"## Completed Work",
		tasks,
		"",
		"## QA",
		`Approved: ${qaOutcome.approved ? "yes" : "no"}`,
		qaOutcome.feedback,
	].join("\n");
}

export async function createPullRequest(options: PrOptions): Promise<PullRequestResult> {
	if (options.prMode === "branch-only") {
		await pushBranch(options.repoPath);
		return {};
	}

	await pushBranch(options.repoPath);
	const bodyFilePath = buildBodyFilePath(options.repoPath, options.branchName);
	await writeFile(bodyFilePath, options.body, "utf8");
	const draftFlag = options.prMode === "draft-pr" ? " --draft" : "";
	let createOutput = "";
	try {
		createOutput = await runCommand(
			`gh pr create --base ${JSON.stringify(options.baseBranch)} --head ${JSON.stringify(options.branchName)} --title ${JSON.stringify(options.title)} --body-file ${JSON.stringify(bodyFilePath)}${draftFlag}`,
			options.repoPath,
		);
	} finally {
		await rm(bodyFilePath, { force: true }).catch(() => undefined);
	}
	const prUrl = extractUrl(createOutput);

	if (!prUrl) {
		throw new Error(`gh pr create did not return a pull request URL. Output: ${createOutput}`);
	}

	if (options.prMode === "auto-merge") {
		await runCommand(`gh pr merge ${JSON.stringify(prUrl)} --auto --squash`, options.repoPath);
		return { prUrl, merged: true };
	}

	return { prUrl, merged: false };
}
