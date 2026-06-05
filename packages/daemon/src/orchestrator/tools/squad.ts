import { QA_MAX_REVISIONS, type Squad, type SquadConfig } from "@io/shared";
import { z } from "zod";

import type { Config } from "../../config.js";
import type { ToolDefinition } from "../../copilot/session.js";
import { executeObjective } from "../../execution/runner.js";
import { hireSquad, proposeSquadComposition } from "../../squad/hiring.js";
import { getSquadStatus } from "../../squad/manager.js";
import {
	createObjective,
	deleteSquad,
	getActiveObjectives,
	getSquad,
	listSquads,
	updateSquad,
} from "../../store/index.js";

export type OrchestratorToolResult = string | Record<string, unknown> | null | undefined;
export type OrchestratorToolExecutor = (
	toolName: string,
	args: Record<string, unknown>,
) => Promise<OrchestratorToolResult>;

const hireSquadSchema = z.object({
	repoUrl: z.string().trim().min(1),
});

const squadIdSchema = z.object({
	squadId: z.string().trim().min(1),
});

const delegateToSquadSchema = z.object({
	squadId: z.string().trim().min(1),
	objective: z.string().trim().min(1),
});

export const squadToolDefinitions: ToolDefinition[] = [
	{
		name: "hire_squad",
		description: "Hire or refresh a squad for a repository.",
		parameters: hireSquadSchema,
		skipPermission: true,
	},
	{
		name: "fire_squad",
		description: "Deactivate or delete a squad.",
		parameters: squadIdSchema,
		skipPermission: true,
	},
	{
		name: "list_squads",
		description: "List all squads and their status.",
		parameters: z.object({}),
		skipPermission: true,
	},
	{
		name: "get_squad_status",
		description: "Get detailed status for a squad and its active objectives.",
		parameters: squadIdSchema,
		skipPermission: true,
	},
	{
		name: "delegate_to_squad",
		description: "Create an objective for a squad and start execution.",
		parameters: delegateToSquadSchema,
		skipPermission: true,
	},
];

function getDefaultSquadConfig(_config: Config): SquadConfig {
	return {
		prMode: "draft-pr",
		mcpServers: [],
		maxRevisions: QA_MAX_REVISIONS,
	};
}

function buildRepoAnalysis(repoUrl: string): string {
	const normalized = repoUrl.trim();
	const name =
		normalized
			.split("/")
			.filter(Boolean)
			.at(-1)
			?.replace(/\.git$/iu, "") ?? normalized;
	return `Repository URL: ${normalized}\nRepository name: ${name}\nUse the repository identity and any available conventions to propose a practical squad composition.`;
}

function formatSquadList(squads: Squad[]): string {
	if (squads.length === 0) {
		return "No squads are currently configured.";
	}

	return squads
		.map(
			(squad) =>
				`${squad.id}: ${squad.name} (${squad.repoOwner}/${squad.repoName}) [${squad.status}]`,
		)
		.join("\n");
}

export function createSquadToolExecutor(config: Config): OrchestratorToolExecutor {
	return async (toolName, rawArgs) => {
		switch (toolName) {
			case "hire_squad": {
				const { repoUrl } = hireSquadSchema.parse(rawArgs);
				const composition = await proposeSquadComposition(repoUrl, buildRepoAnalysis(repoUrl));
				const result = await hireSquad(repoUrl, composition, getDefaultSquadConfig(config));
				return {
					message: `Squad ready for ${repoUrl}.`,
					squad: result.squad,
					members: result.members,
				};
			}
			case "fire_squad": {
				const { squadId } = squadIdSchema.parse(rawArgs);
				const squad = await getSquad(squadId);
				if (!squad) {
					throw new Error(`Squad ${squadId} was not found.`);
				}

				const activeObjectives = await getActiveObjectives(squadId);
				if (activeObjectives.length > 0) {
					const updated = await updateSquad(squadId, { status: "inactive" });
					return {
						message: `Squad ${squadId} was deactivated because it still has active objectives.`,
						squad: updated,
						activeObjectives,
					};
				}

				await deleteSquad(squadId);
				return { message: `Squad ${squadId} was deleted.`, squadId };
			}
			case "list_squads": {
				const squads = await listSquads();
				return {
					message: formatSquadList(squads),
					squads,
				};
			}
			case "get_squad_status": {
				const { squadId } = squadIdSchema.parse(rawArgs);
				const status = await getSquadStatus(squadId);
				return {
					message: `Squad ${status.squad.name} has ${status.activeObjectivesCount} active objective(s).`,
					...status,
				};
			}
			case "delegate_to_squad": {
				const { squadId, objective } = delegateToSquadSchema.parse(rawArgs);
				const squad = await getSquad(squadId);
				if (!squad) {
					throw new Error(`Squad ${squadId} was not found.`);
				}

				const createdObjective = await createObjective(squadId, objective);
				void executeObjective(squadId, createdObjective.id).catch(async (error: unknown) => {
					const message = error instanceof Error ? error.message : String(error);
					await updateSquad(squadId, { status: "active" }).catch(() => undefined);
					console.error(`Failed to execute objective ${createdObjective.id}: ${message}`);
				});
				return {
					message: `Delegated objective to squad ${squad.name}. Execution started in the background.`,
					objective: createdObjective,
				};
			}
			default:
				throw new Error(`Unsupported squad tool: ${toolName}`);
		}
	};
}
