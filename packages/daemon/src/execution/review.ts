import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { PREMIUM_MODEL } from "@io/shared";
import type { Objective, SquadMember, Task } from "@io/shared";

import { TEAM_LEAD_PROMPT } from "../squad/roles.js";

export interface ReviewOutcome {
	approved: boolean;
	summary: string;
	issues?: string[];
}

interface ParsedReviewResponse {
	approved?: boolean;
	summary?: string;
	issues?: string[];
}

function extractJsonObject(content: string): string | null {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		return fenced[1].trim();
	}

	const start = content.indexOf("{");
	const end = content.lastIndexOf("}");
	return start >= 0 && end > start ? content.slice(start, end + 1) : null;
}

function buildTaskSummary(tasks: Task[]): string {
	return tasks
		.map(
			(task, index) =>
				`${index + 1}. ${task.title}\nStatus: ${task.status}\nDescription: ${task.description}\nResult: ${task.result ?? "No result recorded."}`,
		)
		.join("\n\n");
}

function buildFallbackReview(tasks: Task[]): ReviewOutcome {
	const failedTasks = tasks.filter((task) => task.status !== "done");
	return {
		approved: failedTasks.length === 0,
		summary:
			failedTasks.length === 0
				? "All tasks completed and no blocking issues were detected during fallback review."
				: "Fallback review found unfinished tasks.",
		issues: failedTasks.map((task) => `${task.title} is ${task.status}.`),
	};
}

export async function conductReview(
	objective: Objective,
	tasks: Task[],
	members: SquadMember[],
): Promise<ReviewOutcome> {
	const teamLead = members.find((member) => member.role === "team-lead") ?? members[0];
	if (!teamLead) {
		return buildFallbackReview(tasks);
	}

	const prompt = `Objective:\n${objective.description}\n\nTask results:\n${buildTaskSummary(tasks)}\n\nReturn strict JSON:\n{\n  \"approved\": true,\n  \"summary\": \"short review summary\",\n  \"issues\": [\"only include blocking issues\"]\n}`;

	let client: CopilotClient | null = null;
	try {
		client = new CopilotClient();
		await client.start();
		const session = await client.createSession({
			model: teamLead.model ?? PREMIUM_MODEL,
			onPermissionRequest: approveAll,
			systemMessage: {
				content: `${TEAM_LEAD_PROMPT}\n\nYou are conducting a final coordination review before QA.`,
			},
		});

		try {
			const response = await session.sendAndWait({ prompt }, 60_000);
			const content = response?.data.content?.trim() ?? "";
			const json = extractJsonObject(content);
			if (!json) {
				return buildFallbackReview(tasks);
			}

			const parsed = JSON.parse(json) as ParsedReviewResponse;
			return {
				approved: parsed.approved ?? false,
				summary: parsed.summary?.trim() || "Review completed.",
				issues: parsed.issues?.filter((issue) => issue.trim().length > 0),
			};
		} finally {
			await session.disconnect().catch(() => undefined);
		}
	} catch {
		return buildFallbackReview(tasks);
	} finally {
		if (client) {
			await client.stop().catch(() => []);
		}
	}
}
