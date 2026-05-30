import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import { hireSquad } from '../squad/hiring.js';
import {
	bootSquad,
	delegateToSquad,
	getSquadByName,
	getSquadMembers,
	listSquads,
} from '../squad/manager.js';

export function createOrchestratorTools() {
	return [
		defineTool('list_squads', {
			description:
				'List all active squads and their current status. Use this when the user asks about their teams or projects.',
			parameters: z.object({}).strict(),
			handler: async () => {
				const squads = await listSquads();
				if (squads.length === 0) {
					return {
						textResultForLlm: JSON.stringify({
							squads: [],
							message: 'No squads currently active.',
						}),
						resultType: 'success' as const,
					};
				}
				const summary = await Promise.all(
					squads.map(async (s) => {
						const members = await getSquadMembers(s.id);
						return {
							name: s.name,
							project: s.projectPath,
							autonomy: s.autonomyTier,
							members: members.map((m) => m.roleName),
							status: s.status,
						};
					}),
				);
				return {
					textResultForLlm: JSON.stringify({ squads: summary }),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('get_squad_status', {
			description:
				'Get the detailed status of a specific squad including active instances, team members, and recent activity.',
			parameters: z.object({
				squadName: z.string().describe('The name of the squad to check'),
			}),
			handler: async (args: { squadName: string }) => {
				const squad = await getSquadByName(args.squadName);
				if (!squad) {
					return {
						textResultForLlm: JSON.stringify({ error: `Squad '${args.squadName}' not found.` }),
						resultType: 'success' as const,
					};
				}
				const members = await getSquadMembers(squad.id);
				return {
					textResultForLlm: JSON.stringify({
						squad: {
							name: squad.name,
							project: squad.projectPath,
							repo: squad.repoUrl,
							autonomy: squad.autonomyTier,
							status: squad.status,
							createdAt: squad.createdAt.toISOString(),
						},
						members: members.map((m) => ({
							role: m.roleName,
							veto: m.isVetoMember,
							tools: m.toolsAllowed,
						})),
					}),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('hire_squad', {
			description:
				'Create a new squad for a project. Analyzes the project repository and recommends team composition. Use when the user wants to create a new team for a codebase.',
			parameters: z.object({
				projectPath: z.string().describe('Absolute path to the project directory'),
				repoUrl: z.string().optional().describe('GitHub repository URL if applicable'),
				name: z.string().optional().describe('Name for the squad (auto-generated if omitted)'),
			}),
			handler: async (args: { projectPath: string; repoUrl?: string; name?: string }) => {
				try {
					const result = await hireSquad({
						projectPath: args.projectPath,
						repoUrl: args.repoUrl,
						name: args.name,
					});
					return {
						textResultForLlm: JSON.stringify({
							message: `Squad '${args.name ?? result.analysis.name}' hired successfully!`,
							squadId: result.squadId,
							analysis: result.analysis,
							members: result.members,
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to hire squad: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('delegate_to_squad', {
			description:
				"Delegate a message or task to a specific squad's team lead. Use this when the user's message relates to a project that has an assigned squad.",
			parameters: z.object({
				squadName: z.string().describe('Name of the squad to delegate to'),
				message: z.string().describe('The full message or task to delegate'),
			}),
			handler: async (args: { squadName: string; message: string }) => {
				const squad = await getSquadByName(args.squadName);
				if (!squad) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Squad '${args.squadName}' not found.`,
						}),
						resultType: 'success' as const,
					};
				}

				try {
					// Boot squad if not already running
					const { getSquadRuntime } = await import('../squad/manager.js');
					if (!getSquadRuntime(squad.id)) {
						await bootSquad(squad);
					}

					const response = await delegateToSquad(squad.id, args.message);
					return {
						textResultForLlm: JSON.stringify({
							delegatedTo: args.squadName,
							teamLeadResponse: response,
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to delegate: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),
	];
}
