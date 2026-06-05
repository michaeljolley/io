import { exec } from "node:child_process";
import { promisify } from "node:util";

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { EVENT_NAMES, QA_MAX_REVISIONS, STANDARD_MODEL } from "@io/shared";
import type { Objective, SquadMember } from "@io/shared";

import { eventBus } from "../event-bus.js";
import { QA_PROMPT } from "../squad/roles.js";
import {
	createInboxItem,
	getObjective,
	incrementRevisionCount,
	updateObjectiveStatus,
} from "../store/index.js";

const execAsync = promisify(exec);
const GIT_DIFF_MAX_BUFFER = 10 * 1024 * 1024;

export interface QAOutcome {
	approved: boolean;
	feedback: string;
}

export interface QARejectionResult {
	revisionCount: number;
	escalated: boolean;
	feedback: string;
	inboxItemId?: string;
}

interface ParsedQaResponse {
	approved?: boolean;
	feedback?: string;
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

export async function getGitDiff(worktreePath: string): Promise<string> {
	const { stdout } = await execAsync("git diff --stat && git diff", {
		cwd: worktreePath,
		maxBuffer: GIT_DIFF_MAX_BUFFER,
	});
	return stdout.trim();
}

export async function runQAReview(
	objective: Objective,
	qaMember: SquadMember,
	worktreePath: string,
	diff: string,
): Promise<QAOutcome> {
	const effectiveDiff =
		diff.trim().length > 0 ? diff : await getGitDiff(worktreePath).catch(() => "");
	if (!effectiveDiff) {
		return {
			approved: false,
			feedback: "QA rejected the work because no git diff was available for review.",
		};
	}

	const prompt = `Objective:\n${objective.description}\n\nGit diff:\n${effectiveDiff}\n\nReturn strict JSON:\n{\n  \"approved\": true,\n  \"feedback\": \"approval or rejection rationale\"\n}`;

	let client: CopilotClient | null = null;
	try {
		client = new CopilotClient({ workingDirectory: worktreePath });
		await client.start();
		const session = await client.createSession({
			model: qaMember.model ?? STANDARD_MODEL,
			workingDirectory: worktreePath,
			onPermissionRequest: approveAll,
			systemMessage: {
				content: QA_PROMPT,
			},
		});

		try {
			const response = await session.sendAndWait({ prompt }, 60_000);
			const content = response?.data.content?.trim() ?? "";
			const json = extractJsonObject(content);
			if (!json) {
				return {
					approved: false,
					feedback:
						"QA could not parse the automated review response. Re-run QA or perform manual review before approval.",
				};
			}

			const parsed = JSON.parse(json) as ParsedQaResponse;
			return {
				approved: parsed.approved ?? false,
				feedback: parsed.feedback?.trim() || "QA completed without additional detail.",
			};
		} finally {
			await session.disconnect().catch(() => undefined);
		}
	} catch {
		return {
			approved: false,
			feedback: "QA session could not be started. Manual QA review is required before approval.",
		};
	} finally {
		if (client) {
			await client.stop().catch(() => []);
		}
	}
}

export async function handleQARejection(
	objectiveId: string,
	feedback: string,
): Promise<QARejectionResult> {
	const objective = await incrementRevisionCount(objectiveId);
	if (!objective) {
		throw new Error(`Unable to increment revision count for objective ${objectiveId}`);
	}

	eventBus.emit(EVENT_NAMES.QA_REJECTED, {
		objectiveId,
		reason: feedback,
		revisionCount: objective.revisionCount,
	});

	if (objective.revisionCount < QA_MAX_REVISIONS) {
		return {
			revisionCount: objective.revisionCount,
			escalated: false,
			feedback,
		};
	}

	const fullObjective = await getObjective(objectiveId);
	const inboxItem = await createInboxItem({
		squadId: fullObjective?.squadId ?? null,
		objectiveId,
		type: "escalation",
		title: "QA escalation required",
		content: feedback,
	});
	await updateObjectiveStatus(objectiveId, "escalated");
	eventBus.emit(EVENT_NAMES.QA_ESCALATED, { objectiveId, reason: feedback });
	return {
		revisionCount: objective.revisionCount,
		escalated: true,
		feedback,
		inboxItemId: inboxItem.id,
	};
}
