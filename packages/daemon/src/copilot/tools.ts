import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import {
	activateSkill,
	deactivateSkill,
	getActiveSkills,
	installSkillFromUrl,
	listInstalledSkills,
	removeSkill,
} from '../skills/index.js';
import { runInstance } from '../squad/execution/runner.js';
import { hireSquad } from '../squad/hiring.js';
import {
	bootSquad,
	delegateToSquad,
	getSquadByName,
	getSquadMembers,
	getSquadRuntime,
	listSquads,
} from '../squad/manager.js';
import { listInboxEntries, resolveInboxEntry } from '../store/inbox.js';
import { createSchedule, deleteSchedule, listSchedules } from '../store/schedules.js';
import {
	getOrchestratorScopes,
	getPageListing,
	listWikiPages,
	readWikiPage,
	searchWiki,
	writeWikiPage,
} from '../wiki/index.js';

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

		defineTool('run_squad_instance', {
			description:
				'Start a new work instance for a squad. This kicks off the full lifecycle: meeting → task execution → PR creation. Use when the user asks a squad to work on something specific.',
			parameters: z.object({
				squadName: z.string().describe('Name of the squad'),
				objective: z.string().describe('What the squad should accomplish'),
				issueRef: z.string().optional().describe('GitHub issue reference (e.g., #42)'),
			}),
			handler: async (args: { squadName: string; objective: string; issueRef?: string }) => {
				const squad = await getSquadByName(args.squadName);
				if (!squad) {
					return {
						textResultForLlm: JSON.stringify({ error: `Squad '${args.squadName}' not found.` }),
						resultType: 'success' as const,
					};
				}

				try {
					const result = await runInstance({
						squad,
						objective: args.objective,
						issueRef: args.issueRef,
					});

					return {
						textResultForLlm: JSON.stringify({
							instanceId: result.instanceId,
							success: result.success,
							pr: result.pr ? { url: result.pr.url, number: result.pr.number } : null,
							error: result.error,
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to run instance: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('list_inbox', {
			description:
				"List unread inbox entries from squads. Shows deliverables and pending questions that need the user's attention.",
			parameters: z.object({
				status: z
					.enum(['unread', 'read', 'resolved'])
					.optional()
					.describe('Filter by status (default: unread)'),
			}),
			handler: async (args: { status?: 'unread' | 'read' | 'resolved' }) => {
				const entries = await listInboxEntries({
					status: args.status ?? 'unread',
					limit: 20,
				});

				if (entries.length === 0) {
					return {
						textResultForLlm: JSON.stringify({ entries: [], message: 'No inbox entries.' }),
						resultType: 'success' as const,
					};
				}

				const summary = entries.map((e) => ({
					id: e.id,
					squad: e.squadId,
					kind: e.kind,
					title: e.title,
					content: e.content.slice(0, 500),
					status: e.status,
					createdAt: e.createdAt,
				}));

				return {
					textResultForLlm: JSON.stringify({ entries: summary }),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('respond_to_inbox', {
			description:
				"Respond to an inbox question from a squad. Use this when the user provides an answer to a squad's pending question. This unblocks the squad so it can continue working.",
			parameters: z.object({
				entryId: z.string().describe('The inbox entry ID to respond to'),
				response: z.string().describe("The user's response to the squad's question"),
			}),
			handler: async (args: { entryId: string; response: string }) => {
				try {
					const unblocked = await resolveInboxEntry(args.entryId, args.response);
					return {
						textResultForLlm: JSON.stringify({
							resolved: true,
							squadUnblocked: unblocked,
							message: unblocked
								? 'Response delivered — squad has been unblocked and will continue working.'
								: 'Response recorded (squad was not actively waiting).',
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to respond: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('create_schedule', {
			description:
				'Create a cron-based schedule that triggers a squad or the orchestrator with a predefined prompt at specified times. Use standard cron syntax (e.g., "0 9 * * 1-5" for weekdays at 9am).',
			parameters: z.object({
				name: z.string().describe('Human-readable name for the schedule (e.g., "Daily Standup")'),
				targetType: z
					.enum(['squad', 'orchestrator'])
					.describe('Whether to target a squad or the orchestrator'),
				targetId: z.string().optional().describe('Squad name (required if targetType is "squad")'),
				cron: z.string().describe('Cron expression (e.g., "0 9 * * 1-5" for weekdays at 9am)'),
				prompt: z.string().describe('The prompt/message to send when the schedule fires'),
			}),
			handler: async (args: {
				name: string;
				targetType: 'squad' | 'orchestrator';
				targetId?: string;
				cron: string;
				prompt: string;
			}) => {
				try {
					// Validate squad exists if targeting a squad
					if (args.targetType === 'squad') {
						if (!args.targetId) {
							return {
								textResultForLlm: JSON.stringify({
									error: 'targetId (squad name) is required for squad schedules',
								}),
								resultType: 'success' as const,
							};
						}
						const squad = await getSquadByName(args.targetId);
						if (!squad) {
							return {
								textResultForLlm: JSON.stringify({ error: `Squad '${args.targetId}' not found` }),
								resultType: 'success' as const,
							};
						}
						args.targetId = squad.id;
					}

					const schedule = await createSchedule({
						name: args.name,
						targetType: args.targetType,
						targetId: args.targetId,
						cron: args.cron,
						prompt: args.prompt,
					});

					return {
						textResultForLlm: JSON.stringify({
							created: true,
							schedule: {
								id: schedule.id,
								name: schedule.name,
								cron: schedule.cron,
								nextRun: schedule.nextRun,
							},
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to create schedule: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('list_schedules', {
			description: 'List all configured schedules (cron-based automations).',
			parameters: z.object({}).strict(),
			handler: async () => {
				const schedules = await listSchedules();
				if (schedules.length === 0) {
					return {
						textResultForLlm: JSON.stringify({
							schedules: [],
							message: 'No schedules configured.',
						}),
						resultType: 'success' as const,
					};
				}

				const summary = schedules.map((s) => ({
					id: s.id,
					name: s.name,
					targetType: s.targetType,
					targetId: s.targetId,
					cron: s.cron,
					prompt: s.prompt.slice(0, 100),
					enabled: s.enabled,
					nextRun: s.nextRun,
					lastRun: s.lastRun,
				}));

				return {
					textResultForLlm: JSON.stringify({ schedules: summary }),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('delete_schedule', {
			description: 'Delete a schedule by ID. Use list_schedules first to find the ID.',
			parameters: z.object({
				scheduleId: z.string().describe('The ID of the schedule to delete'),
			}),
			handler: async (args: { scheduleId: string }) => {
				try {
					await deleteSchedule(args.scheduleId);
					return {
						textResultForLlm: JSON.stringify({ deleted: true, scheduleId: args.scheduleId }),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('read_wiki', {
			description:
				'Read from the wiki knowledge base. Call with no pageName to list available pages, or with a pageName to read its content. You have access to IO-level and Shared wiki scopes.',
			parameters: z.object({
				scope: z.enum(['io', 'shared']).describe('Which wiki scope to read from'),
				pageName: z
					.string()
					.optional()
					.describe('Page name to read (omit to list all pages in scope)'),
			}),
			handler: async (args: { scope: 'io' | 'shared'; pageName?: string }) => {
				if (!args.pageName) {
					const pages = listWikiPages(args.scope);
					return {
						textResultForLlm: JSON.stringify({
							scope: args.scope,
							pages: pages.length > 0 ? pages : '(empty)',
						}),
						resultType: 'success' as const,
					};
				}
				const page = readWikiPage(args.scope, args.pageName);
				if (!page) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Page '${args.pageName}' not found in ${args.scope} wiki`,
						}),
						resultType: 'success' as const,
					};
				}
				return {
					textResultForLlm: JSON.stringify({
						scope: page.scope,
						name: page.name,
						content: page.content,
					}),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('write_wiki', {
			description:
				'Write a page to the wiki knowledge base. Provide the full page content (read existing first and merge if updating). You can write to IO-level and Shared scopes.',
			parameters: z.object({
				scope: z.enum(['io', 'shared']).describe('Which wiki scope to write to'),
				pageName: z
					.string()
					.describe('Page name (no .md extension, e.g., "preferences" or "routing-conventions")'),
				content: z.string().describe('Full markdown content for the page'),
			}),
			handler: async (args: { scope: 'io' | 'shared'; pageName: string; content: string }) => {
				writeWikiPage(args.scope, args.pageName, args.content);
				return {
					textResultForLlm: JSON.stringify({
						written: true,
						scope: args.scope,
						pageName: args.pageName,
					}),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('search_wiki', {
			description: 'Search across wiki pages by keyword. Searches IO-level and Shared scopes.',
			parameters: z.object({
				keyword: z.string().describe('Keyword or phrase to search for'),
			}),
			handler: async (args: { keyword: string }) => {
				const results = searchWiki(args.keyword, getOrchestratorScopes());
				if (results.length === 0) {
					return {
						textResultForLlm: JSON.stringify({ results: [], message: 'No matches found.' }),
						resultType: 'success' as const,
					};
				}
				return {
					textResultForLlm: JSON.stringify({ results }),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('install_skill', {
			description:
				'Install a skill from a URL (raw GitHub URL to a SKILL.md file). Skills extend IO or squad capabilities with additional instructions and behaviors.',
			parameters: z.object({
				name: z
					.string()
					.describe('Name for the skill (kebab-case, e.g., "tdd-workflow" or "code-review")'),
				url: z
					.string()
					.describe(
						'URL to the raw SKILL.md content (e.g., raw.githubusercontent.com/.../SKILL.md)',
					),
			}),
			handler: async (args: { name: string; url: string }) => {
				try {
					const skill = await installSkillFromUrl(args.name, args.url);
					return {
						textResultForLlm: JSON.stringify({
							installed: true,
							name: skill.name,
							preview: skill.content.slice(0, 200),
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to install: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('list_skills', {
			description: 'List all installed skills and their activation status.',
			parameters: z.object({}).strict(),
			handler: async () => {
				const installed = listInstalledSkills();
				const orchestratorActivations = await getActiveSkills('orchestrator');

				const summary = installed.map((s) => ({
					name: s.name,
					activatedForOrchestrator: orchestratorActivations.some((a) => a.skillName === s.name),
					preview: s.content.slice(0, 100),
				}));

				return {
					textResultForLlm: JSON.stringify({
						skills: summary.length > 0 ? summary : '(no skills installed)',
					}),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('activate_skill', {
			description:
				'Activate an installed skill for the orchestrator or a specific squad. Active skills are injected into the system prompt.',
			parameters: z.object({
				skillName: z.string().describe('Name of the installed skill'),
				targetType: z
					.enum(['orchestrator', 'squad'])
					.describe('Activate for orchestrator or a specific squad'),
				targetId: z.string().optional().describe('Squad name (required if targetType is "squad")'),
			}),
			handler: async (args: {
				skillName: string;
				targetType: 'orchestrator' | 'squad';
				targetId?: string;
			}) => {
				try {
					let resolvedTargetId = args.targetId ?? null;
					if (args.targetType === 'squad' && args.targetId) {
						const squad = await getSquadByName(args.targetId);
						if (!squad) {
							return {
								textResultForLlm: JSON.stringify({ error: `Squad '${args.targetId}' not found` }),
								resultType: 'success' as const,
							};
						}
						resolvedTargetId = squad.id;
					}

					await activateSkill(args.skillName, args.targetType, resolvedTargetId ?? undefined);
					return {
						textResultForLlm: JSON.stringify({
							activated: true,
							skillName: args.skillName,
							target: args.targetType === 'orchestrator' ? 'orchestrator' : args.targetId,
						}),
						resultType: 'success' as const,
					};
				} catch (err) {
					return {
						textResultForLlm: JSON.stringify({
							error: `Failed to activate: ${err instanceof Error ? err.message : String(err)}`,
						}),
						resultType: 'success' as const,
					};
				}
			},
		}),

		defineTool('deactivate_skill', {
			description: 'Deactivate a skill (stop injecting it into the system prompt).',
			parameters: z.object({
				skillName: z.string().describe('Name of the skill to deactivate'),
				targetType: z
					.enum(['orchestrator', 'squad'])
					.describe('Deactivate from orchestrator or a specific squad'),
				targetId: z.string().optional().describe('Squad name (required if targetType is "squad")'),
			}),
			handler: async (args: {
				skillName: string;
				targetType: 'orchestrator' | 'squad';
				targetId?: string;
			}) => {
				await deactivateSkill(args.skillName, args.targetType, args.targetId ?? undefined);
				return {
					textResultForLlm: JSON.stringify({ deactivated: true, skillName: args.skillName }),
					resultType: 'success' as const,
				};
			},
		}),

		defineTool('remove_skill', {
			description: 'Uninstall a skill completely (removes files and all activations).',
			parameters: z.object({
				skillName: z.string().describe('Name of the skill to remove'),
			}),
			handler: async (args: { skillName: string }) => {
				removeSkill(args.skillName);
				return {
					textResultForLlm: JSON.stringify({ removed: true, skillName: args.skillName }),
					resultType: 'success' as const,
				};
			},
		}),
	];
}
