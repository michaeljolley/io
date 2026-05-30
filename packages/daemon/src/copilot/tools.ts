import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';

export function createOrchestratorTools() {
	return [
		defineTool('list_squads', {
			description:
				'List all active squads and their current status. Use this when the user asks about their teams or projects.',
			parameters: z.object({}).strict(),
			handler: async () => {
				// TODO: Query actual squads from database
				return {
					textResultForLlm: JSON.stringify({ squads: [], message: 'No squads currently active.' }),
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
				// TODO: Look up squad by name and return status
				return {
					textResultForLlm: JSON.stringify({ error: `Squad '${args.squadName}' not found.` }),
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
				// TODO: Analyze project, recommend team, create squad
				return {
					textResultForLlm: JSON.stringify({
						message: `Squad creation for '${args.projectPath}' is not yet implemented.`,
					}),
					resultType: 'success' as const,
				};
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
				// TODO: Route message to squad's team lead
				return {
					textResultForLlm: JSON.stringify({
						message: `Delegation to squad '${args.squadName}' is not yet implemented.`,
					}),
					resultType: 'success' as const,
				};
			},
		}),
	];
}
