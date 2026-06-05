import { exec } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { PREMIUM_MODEL } from "@io/shared";
import type { Objective, SquadMember } from "@io/shared";

import { TEAM_LEAD_PROMPT } from "../squad/roles.js";

const execAsync = promisify(exec);
const README_CANDIDATES = ["README.md", "readme.md"];
const MAX_REPO_CONTEXT_LENGTH = 8_000;

export interface PlanTask {
	title: string;
	description: string;
	assigneeRole: string;
}

export interface PlanResult {
	plan: string;
	tasks: PlanTask[];
}

interface ParsedPlanResponse {
	plan?: string;
	tasks?: PlanTask[];
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function buildRepoContext(repoPath: string): Promise<string> {
	for (const candidate of README_CANDIDATES) {
		const readmePath = join(repoPath, candidate);
		if (await fileExists(readmePath)) {
			const content = await readFile(readmePath, "utf8");
			return content.slice(0, MAX_REPO_CONTEXT_LENGTH);
		}
	}

	const { stdout } = await execAsync("git ls-files", {
		cwd: repoPath,
		maxBuffer: 5 * 1024 * 1024,
	});
	const files = stdout.split(/\r?\n/).filter(Boolean).slice(0, 200).join("\n");
	return files.slice(0, MAX_REPO_CONTEXT_LENGTH);
}

function extractJsonObject(content: string): string | null {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		return fenced[1].trim();
	}

	const start = content.indexOf("{");
	const end = content.lastIndexOf("}");
	if (start >= 0 && end > start) {
		return content.slice(start, end + 1);
	}

	return null;
}

function normalizePlanTasks(tasks: PlanTask[] | undefined, members: SquadMember[]): PlanTask[] {
	if (!tasks || tasks.length === 0) {
		return [
			{
				title: "Implement objective",
				description: "Implement the requested objective and validate the affected behavior.",
				assigneeRole: members.find((member) => member.role !== "qa")?.role ?? "team-lead",
			},
		];
	}

	return tasks.map((task, index) => ({
		title: task.title?.trim() || `Task ${index + 1}`,
		description: task.description?.trim() || task.title?.trim() || `Task ${index + 1}`,
		assigneeRole:
			task.assigneeRole?.trim() ||
			members.find((member) => member.role !== "qa")?.role ||
			"team-lead",
	}));
}

function buildFallbackPlan(objective: Objective, members: SquadMember[]): PlanResult {
	const assigneeRole = members.find((member) => member.role !== "qa")?.role ?? "team-lead";
	return {
		plan: `1. Analyze the objective: ${objective.description}\n2. Implement the required code changes.\n3. Validate the affected behavior and summarize the outcome.`,
		tasks: [
			{
				title: "Implement objective",
				description: objective.description,
				assigneeRole,
			},
		],
	};
}

export async function createPlan(
	objective: Objective,
	squadMembers: SquadMember[],
	repoPath: string,
): Promise<PlanResult> {
	const repoContext = await buildRepoContext(repoPath).catch(
		() => "Repository context unavailable.",
	);
	const availableRoles = squadMembers
		.map((member) => `- ${member.role}: ${member.name}`)
		.join("\n");
	const prompt = `Objective:\n${objective.description}\n\nAvailable squad members:\n${availableRoles}\n\nRepository context:\n${repoContext}\n\nReturn strict JSON in this shape:\n{\n  \"plan\": \"numbered plan\",\n  \"tasks\": [\n    {\n      \"title\": \"task title\",\n      \"description\": \"implementation details and validation\",\n      \"assigneeRole\": \"team-lead\"\n    }\n  ]\n}`;

	let client: CopilotClient | null = null;
	try {
		client = new CopilotClient({ workingDirectory: repoPath });
		await client.start();
		const session = await client.createSession({
			model: PREMIUM_MODEL,
			workingDirectory: repoPath,
			onPermissionRequest: approveAll,
			systemMessage: {
				content: `${TEAM_LEAD_PROMPT}\n\nRepository context for planning:\n${repoContext}`,
			},
		});

		try {
			const response = await session.sendAndWait({ prompt }, 90_000);
			const content = response?.data.content?.trim() ?? "";
			const json = extractJsonObject(content);
			if (!json) {
				return buildFallbackPlan(objective, squadMembers);
			}

			const parsed = JSON.parse(json) as ParsedPlanResponse;
			return {
				plan: parsed.plan?.trim() || buildFallbackPlan(objective, squadMembers).plan,
				tasks: normalizePlanTasks(parsed.tasks, squadMembers),
			};
		} finally {
			await session.disconnect().catch(() => undefined);
		}
	} catch {
		return buildFallbackPlan(objective, squadMembers);
	} finally {
		if (client) {
			await client.stop().catch(() => []);
		}
	}
}
