import { type CopilotSession, approveAll, defineTool } from '@github/copilot-sdk';
import type { AgentEvent, AgentStatus } from '@io/shared';
import { z } from 'zod';
import { getClient } from '../copilot/client.js';
import { createChildLogger } from '../logging/logger.js';
import { getEventBus } from './event-bus.js';
import { type SkillDefinition, compileSystemPrompt } from './skill-parser.js';

export interface AgentConfig {
	skill: SkillDefinition;
	squadId: string;
	squadName: string;
	instanceId?: string;
	model?: string;
}

export interface AgentMessage {
	role: 'user' | 'system';
	content: string;
}

type Session = Awaited<ReturnType<Awaited<ReturnType<typeof getClient>>['createSession']>>;

/**
 * Base agent class. Each agent has its own Copilot session, enforces
 * tool allowlists from its SKILL.md, and emits events on the bus.
 */
export class Agent {
	readonly role: string;
	readonly squadId: string;
	readonly instanceId?: string;
	private session: Session | null = null;
	private skill: SkillDefinition;
	private model: string;
	private logger;
	private _status: AgentStatus = 'idle';

	constructor(config: AgentConfig) {
		this.skill = config.skill;
		this.role = config.skill.role;
		this.squadId = config.squadId;
		this.instanceId = config.instanceId;
		this.model = config.model ?? 'claude-opus-4.6';
		this.logger = createChildLogger(`agent:${config.squadName}:${this.role}`);
	}

	get status(): AgentStatus {
		return this._status;
	}

	/** Initialize the agent's Copilot session */
	async init(squadContext?: string): Promise<void> {
		const client = await getClient();
		const systemPrompt = compileSystemPrompt(this.skill, squadContext);

		this.session = await client.createSession({
			model: this.model,
			systemMessage: { mode: 'replace', content: systemPrompt },
			onPermissionRequest: approveAll,
			tools: this.buildTools(),
		});

		this.logger.info('Agent session initialized');
	}

	/** Send a message and get a response */
	async send(content: string): Promise<string> {
		if (!this.session) {
			throw new Error(`Agent ${this.role} not initialized`);
		}

		this._status = 'working';
		this.emitEvent('agent:task_started', { content: content.slice(0, 100) });

		try {
			const result = await this.session.sendAndWait({ prompt: content }, 300_000);
			const response = result?.data?.content ?? '';
			this._status = 'idle';
			this.emitEvent('agent:task_completed', { responseLength: response.length });
			return response;
		} catch (err) {
			this._status = 'error';
			this.logger.error({ err }, 'Agent send failed');
			this.emitEvent('agent:error', {
				error: err instanceof Error ? err.message : String(err),
			});
			throw err;
		}
	}

	/** Destroy the agent's session */
	async destroy(): Promise<void> {
		if (this.session) {
			await this.session.disconnect();
			this.session = null;
		}
		this.logger.info('Agent destroyed');
	}

	/** Build allowed tools for this agent based on SKILL.md */
	private buildTools() {
		const tools = [];

		// Always allow a "report" tool so agents can communicate results
		tools.push(
			defineTool('report_to_team_lead', {
				description: 'Report findings or completed work back to the team lead.',
				parameters: z.object({
					summary: z.string().describe('Summary of work completed or findings'),
					status: z
						.enum(['done', 'blocked', 'needs_review'])
						.describe('Current status of the work'),
				}),
				handler: async (args: { summary: string; status: string }) => {
					this.logger.info({ status: args.status }, 'Agent reported to team lead');
					return {
						textResultForLlm: JSON.stringify({
							acknowledged: true,
							message: 'Report received by team lead.',
						}),
						resultType: 'success' as const,
					};
				},
			}),
		);

		// Add role-specific tools based on allowlist
		if (this.skill.tools.includes('read_file')) {
			tools.push(
				defineTool('read_file', {
					description: 'Read the contents of a file in the project.',
					parameters: z.object({
						path: z.string().describe('Relative path to the file'),
					}),
					handler: async (args: { path: string }) => {
						// TODO: Implement actual file reading with path sandboxing
						return {
							textResultForLlm: `[read_file] Would read: ${args.path}`,
							resultType: 'success' as const,
						};
					},
				}),
			);
		}

		if (this.skill.tools.includes('edit_file')) {
			tools.push(
				defineTool('edit_file', {
					description: 'Edit a file in the project. Provide the full new content.',
					parameters: z.object({
						path: z.string().describe('Relative path to the file'),
						content: z.string().describe('New file content'),
					}),
					handler: async (args: { path: string; content: string }) => {
						// TODO: Implement actual file editing with path sandboxing
						return {
							textResultForLlm: `[edit_file] Would write ${args.content.length} chars to: ${args.path}`,
							resultType: 'success' as const,
						};
					},
				}),
			);
		}

		if (this.skill.tools.includes('run_command')) {
			tools.push(
				defineTool('run_command', {
					description: 'Run a shell command in the project directory.',
					parameters: z.object({
						command: z.string().describe('The command to execute'),
					}),
					handler: async (args: { command: string }) => {
						// TODO: Implement actual command execution with sandboxing
						return {
							textResultForLlm: `[run_command] Would run: ${args.command}`,
							resultType: 'success' as const,
						};
					},
				}),
			);
		}

		if (this.skill.tools.includes('search_code')) {
			tools.push(
				defineTool('search_code', {
					description: 'Search for patterns in the project codebase.',
					parameters: z.object({
						pattern: z.string().describe('Search pattern (regex or text)'),
						glob: z.string().optional().describe('File glob to limit search'),
					}),
					handler: async (args: { pattern: string; glob?: string }) => {
						// TODO: Implement actual code search
						return {
							textResultForLlm: `[search_code] Would search for: ${args.pattern}`,
							resultType: 'success' as const,
						};
					},
				}),
			);
		}

		return tools;
	}

	private emitEvent(type: AgentEvent['type'], data?: Record<string, unknown>) {
		getEventBus()
			.emit({
				id: crypto.randomUUID(),
				timestamp: new Date(),
				type,
				squadId: this.squadId,
				instanceId: this.instanceId,
				agentRole: this.role,
				model: this.model,
				data,
			})
			.catch((err) => {
				this.logger.error({ err }, 'Failed to emit agent event');
			});
	}
}
