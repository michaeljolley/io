import { type CopilotSession, approveAll, defineTool } from '@github/copilot-sdk';
import type { AgentEvent, AgentStatus, ByokConfig } from '@io/shared';
import { exec as execCb } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { getClient } from '../copilot/client.js';
import { buildProvider } from '../copilot/provider.js';
import { createChildLogger } from '../logging/logger.js';
import { recordTokenUsage } from '../models/token-tracker.js';
import { addInboxEntry } from '../store/inbox.js';
import {
	getSquadScopes,
	listWikiPages,
	readWikiPage,
	searchWiki,
	writeWikiPage,
} from '../wiki/index.js';
import { getEventBus } from './event-bus.js';
import { type SkillDefinition, compileSystemPrompt } from './skill-parser.js';

const exec = promisify(execCb);

export interface AgentConfig {
	skill: SkillDefinition;
	squadId: string;
	squadName: string;
	instanceId?: string;
	model?: string;
	byok?: ByokConfig | null;
	identity?: { displayName: string; persona?: string; universe?: string };
}

export interface AgentMessage {
	role: 'user' | 'system';
	content: string;
}

export interface FileAttachment {
	type: 'file';
	path: string;
	displayName?: string;
}

type Session = Awaited<ReturnType<Awaited<ReturnType<typeof getClient>>['createSession']>>;

/**
 * Base agent class. Each agent has its own Copilot session, enforces
 * tool allowlists from its SKILL.md, and emits events on the bus.
 */
export class Agent {
	readonly role: string;
	readonly squadId: string;
	readonly squadName: string;
	readonly instanceId?: string;
	private _currentInstanceId?: string;
	private _workingDir?: string;
	private session: Session | null = null;
	private skill: SkillDefinition;
	private model: string;
	private byok: ByokConfig | null;
	private identity?: { displayName: string; persona?: string; universe?: string };
	private logger;
	private _status: AgentStatus = 'idle';

	constructor(config: AgentConfig) {
		this.skill = config.skill;
		this.role = config.skill.role;
		this.squadId = config.squadId;
		this.squadName = config.squadName;
		this.instanceId = config.instanceId;
		this.model = config.model ?? 'claude-sonnet-4.6';
		this.byok = config.byok ?? null;
		this.identity = config.identity;
		this.logger = createChildLogger(
			`agent:${config.squadName}:${config.identity?.displayName ?? this.role}`,
		);
	}

	/** Set the current instance ID for activity tracking (used during instance execution) */
	setInstanceId(id: string): void {
		this._currentInstanceId = id;
	}

	/** Clear the current instance ID after execution completes */
	clearInstanceId(): void {
		this._currentInstanceId = undefined;
	}

	/** Set the working directory for tool execution (worktree path) */
	setWorkingDir(dir: string): void {
		this._workingDir = dir;
	}

	/** Get the resolved working directory */
	getWorkingDir(): string | undefined {
		return this._workingDir;
	}

	get status(): AgentStatus {
		return this._status;
	}

	/** Initialize the agent's Copilot session */
	async init(squadContext?: string): Promise<void> {
		const client = await getClient();
		const systemPrompt = await compileSystemPrompt(
			this.skill,
			squadContext,
			this.squadName,
			this.squadId,
			this.identity,
		);

		this.session = await client.createSession({
			model: this.model,
			systemMessage: { mode: 'replace', content: systemPrompt },
			onPermissionRequest: approveAll,
			tools: this.buildTools(),
			...(buildProvider(this.byok) && { provider: buildProvider(this.byok) }),
		});

		this.session.on('assistant.usage', (event) => {
			const data = event.data;
			if (data.inputTokens || data.outputTokens) {
				recordTokenUsage({
					squadId: this.squadId,
					agentRole: this.role,
					model: data.model,
					inputTokens: data.inputTokens ?? 0,
					outputTokens: data.outputTokens ?? 0,
				}).catch(() => {});
			}
		});

		// Capture reasoning/thoughts
		this.session.on('assistant.reasoning', (event) => {
			const content = event.data?.content;
			if (content) {
				this.emitEvent('agent:thought', { content });
			}
		});

		// Capture tool calls
		this.session.on('tool.execution_start', (event) => {
			const data = event.data;
			this.emitEvent('agent:tool_call', {
				tool: data.toolName,
				arguments: data.arguments,
				toolCallId: data.toolCallId,
			});
		});

		// Capture tool results
		this.session.on('tool.execution_complete', (event) => {
			const data = event.data;
			this.emitEvent('agent:tool_result', {
				toolCallId: data.toolCallId,
				success: data.success,
				result: data.result?.content?.slice(0, 500),
				error: data.error?.message,
			});
		});

		this.logger.info('Agent session initialized');
	}

	/** Send a message and get a response */
	async send(content: string, attachments?: FileAttachment[]): Promise<string> {
		if (!this.session) {
			throw new Error(`Agent ${this.role} not initialized`);
		}

		this._status = 'working';
		this.emitEvent('agent:task_started', { content: content.slice(0, 500) });

		try {
			const options: { prompt: string; attachments?: FileAttachment[] } = { prompt: content };
			if (attachments && attachments.length > 0) {
				options.attachments = attachments;
			}
			const result = await this.session.sendAndWait(options, 300_000);
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

	/** Switch to a different model (reinitializes session) */
	async switchModel(newModel: string, squadContext?: string): Promise<void> {
		if (this.model === newModel) return;
		this.logger.info({ from: this.model, to: newModel }, 'Switching model');
		this.model = newModel;
		if (this.session) {
			await this.session.disconnect().catch(() => {});
			this.session = null;
		}
		await this.init(squadContext);
	}

	/** Get the current model */
	getModel(): string {
		return this.model;
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

		// Always allow a "record_decision" tool to track explicit decision points
		tools.push(
			defineTool('record_decision', {
				description:
					'Record an explicit decision you are making. Use this when choosing between alternatives, setting direction, or making architectural/strategic choices.',
				parameters: z.object({
					decision: z.string().describe('The decision being made'),
					rationale: z
						.string()
						.optional()
						.describe('Why this decision was made'),
				}),
				handler: async (args: { decision: string; rationale?: string }) => {
					this.logger.info('Decision recorded');
					this.emitEvent('agent:decision', {
						decision: args.decision,
						rationale: args.rationale,
					});
					return {
						textResultForLlm: JSON.stringify({
							recorded: true,
							message: 'Decision recorded.',
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
						const cwd = this._workingDir;
						if (!cwd) {
							return {
								textResultForLlm: 'Error: No working directory set. Cannot read files.',
								resultType: 'success' as const,
							};
						}
						const resolved = resolveSafePath(cwd, args.path);
						if (!resolved) {
							return {
								textResultForLlm: `Error: Path "${args.path}" is outside the working directory.`,
								resultType: 'success' as const,
							};
						}
						if (!existsSync(resolved)) {
							return {
								textResultForLlm: `Error: File not found: ${args.path}`,
								resultType: 'success' as const,
							};
						}
						try {
							const content = readFileSync(resolved, 'utf-8');
							// Truncate very large files
							const maxLen = 100_000;
							const truncated = content.length > maxLen
								? `${content.slice(0, maxLen)}\n\n... [truncated, ${content.length} total chars]`
								: content;
							return {
								textResultForLlm: truncated,
								resultType: 'success' as const,
							};
						} catch (err) {
							return {
								textResultForLlm: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
								resultType: 'success' as const,
							};
						}
					},
				}),
			);
		}

		if (this.skill.tools.includes('edit_file')) {
			tools.push(
				defineTool('edit_file', {
					description: 'Write content to a file in the project. Creates the file if it does not exist. Provide the full new content.',
					parameters: z.object({
						path: z.string().describe('Relative path to the file'),
						content: z.string().describe('New file content'),
					}),
					handler: async (args: { path: string; content: string }) => {
						const cwd = this._workingDir;
						if (!cwd) {
							return {
								textResultForLlm: 'Error: No working directory set. Cannot write files.',
								resultType: 'success' as const,
							};
						}
						const resolved = resolveSafePath(cwd, args.path);
						if (!resolved) {
							return {
								textResultForLlm: `Error: Path "${args.path}" is outside the working directory.`,
								resultType: 'success' as const,
							};
						}
						try {
							mkdirSync(dirname(resolved), { recursive: true });
							writeFileSync(resolved, args.content, 'utf-8');
							return {
								textResultForLlm: `Successfully wrote ${args.content.length} chars to ${args.path}`,
								resultType: 'success' as const,
							};
						} catch (err) {
							return {
								textResultForLlm: `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
								resultType: 'success' as const,
							};
						}
					},
				}),
			);
		}

		if (this.skill.tools.includes('run_command')) {
			tools.push(
				defineTool('run_command', {
					description: 'Run a shell command in the project directory. Do NOT use git commands (commit, push, branch, checkout) — the system handles git operations.',
					parameters: z.object({
						command: z.string().describe('The command to execute'),
					}),
					handler: async (args: { command: string }) => {
						const cwd = this._workingDir;
						if (!cwd) {
							return {
								textResultForLlm: 'Error: No working directory set. Cannot run commands.',
								resultType: 'success' as const,
							};
						}
						// Block git commands that could interfere with the system
						const blocked = /^\s*(git\s+(commit|push|pull|checkout|switch|merge|rebase|branch\s+-[dDmM]|tag|remote|init))/i;
						if (blocked.test(args.command)) {
							return {
								textResultForLlm: 'Error: Git mutation commands are not allowed. The system handles git operations after review.',
								resultType: 'success' as const,
							};
						}
						try {
							const { stdout, stderr } = await exec(args.command, {
								cwd,
								timeout: 60_000,
								maxBuffer: 1024 * 1024,
							});
							const output = [
								stdout ? `stdout:\n${stdout.slice(0, 50_000)}` : '',
								stderr ? `stderr:\n${stderr.slice(0, 10_000)}` : '',
							]
								.filter(Boolean)
								.join('\n\n');
							return {
								textResultForLlm: output || '(no output)',
								resultType: 'success' as const,
							};
						} catch (err: unknown) {
							const execErr = err as { stdout?: string; stderr?: string; message?: string };
							const errOutput = [
								execErr.stdout ? `stdout:\n${execErr.stdout.slice(0, 20_000)}` : '',
								execErr.stderr ? `stderr:\n${execErr.stderr.slice(0, 10_000)}` : '',
								execErr.message ? `error: ${execErr.message.slice(0, 500)}` : '',
							]
								.filter(Boolean)
								.join('\n\n');
							return {
								textResultForLlm: `Command failed:\n${errOutput}`,
								resultType: 'success' as const,
							};
						}
					},
				}),
			);
		}

		if (this.skill.tools.includes('search_code')) {
			tools.push(
				defineTool('search_code', {
					description: 'Search for patterns in the project codebase using grep.',
					parameters: z.object({
						pattern: z.string().describe('Search pattern (regex or text)'),
						glob: z.string().optional().describe('File glob to limit search (e.g., "*.ts")'),
					}),
					handler: async (args: { pattern: string; glob?: string }) => {
						const cwd = this._workingDir;
						if (!cwd) {
							return {
								textResultForLlm: 'Error: No working directory set. Cannot search.',
								resultType: 'success' as const,
							};
						}
						try {
							const globArg = args.glob ? `--glob "${args.glob}"` : '';
							const { stdout } = await exec(
								`npx --yes ripgrep-wrapper "${args.pattern}" ${globArg} --max-count 50`,
								{ cwd, timeout: 30_000, maxBuffer: 1024 * 1024 },
							).catch(async () => {
								// Fallback to grep/findstr if ripgrep not available
								const cmd = process.platform === 'win32'
									? `findstr /S /N /R "${args.pattern}" ${args.glob || '*.*'}`
									: `grep -rn "${args.pattern}" ${args.glob ? `--include="${args.glob}"` : ''} . | head -50`;
								return exec(cmd, { cwd, timeout: 30_000, maxBuffer: 1024 * 1024 });
							});
							return {
								textResultForLlm: stdout.slice(0, 50_000) || 'No matches found.',
								resultType: 'success' as const,
							};
						} catch {
							return {
								textResultForLlm: 'No matches found.',
								resultType: 'success' as const,
							};
						}
					},
				}),
			);
		}

		// Wiki tools — always available to all agents
		tools.push(
			defineTool('read_wiki', {
				description:
					'Read from the wiki knowledge base. Call with no pageName to list available pages, or with a pageName to read a specific page. You can access Shared wiki and your squad wiki.',
				parameters: z.object({
					scope: z
						.enum(['shared', 'squad'])
						.describe('"shared" for cross-squad knowledge, "squad" for this squad\'s knowledge'),
					pageName: z.string().optional().describe('Page name to read (omit to list all pages)'),
				}),
				handler: async (args: { scope: 'shared' | 'squad'; pageName?: string }) => {
					const resolvedScope = args.scope === 'squad' ? this.squadName : 'shared';
					if (!args.pageName) {
						const pages = listWikiPages(resolvedScope);
						return {
							textResultForLlm: JSON.stringify({
								scope: args.scope,
								pages: pages.length > 0 ? pages : '(empty)',
							}),
							resultType: 'success' as const,
						};
					}
					const page = readWikiPage(resolvedScope, args.pageName);
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
							scope: args.scope,
							name: page.name,
							content: page.content,
						}),
						resultType: 'success' as const,
					};
				},
			}),
			defineTool('write_wiki', {
				description:
					"Write a page to your squad's wiki knowledge base. Read the existing page first and merge knowledge if updating. You can only write to your squad wiki (not shared).",
				parameters: z.object({
					pageName: z
						.string()
						.describe('Page name (no .md extension, e.g., "architecture" or "conventions")'),
					content: z.string().describe('Full markdown content for the page'),
				}),
				handler: async (args: { pageName: string; content: string }) => {
					writeWikiPage(this.squadName, args.pageName, args.content);
					return {
						textResultForLlm: JSON.stringify({
							written: true,
							scope: 'squad',
							pageName: args.pageName,
						}),
						resultType: 'success' as const,
					};
				},
			}),
			defineTool('search_wiki', {
				description:
					'Search across all accessible wiki pages by keyword. Searches both Shared and your squad wiki.',
				parameters: z.object({
					keyword: z.string().describe('Keyword or phrase to search for'),
				}),
				handler: async (args: { keyword: string }) => {
					const results = searchWiki(args.keyword, getSquadScopes(this.squadName));
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
		);

		// Inbox tool — always available so agents can deliver work to user
		tools.push(
			defineTool('add_to_inbox', {
				description:
					'Create an inbox entry for the user. Use to deliver completed work, ask a blocking question, or leave an informational note.',
				parameters: z.object({
					kind: z
						.enum(['deliverable', 'question', 'note'])
						.describe(
							'Type: deliverable (work product), question (blocks until user responds), note (informational)',
						),
					title: z.string().describe('Short title for the inbox entry'),
					content: z.string().describe('Full content/body of the entry (markdown supported)'),
				}),
				handler: async (args: {
					kind: 'deliverable' | 'question' | 'note';
					title: string;
					content: string;
				}) => {
					try {
						const { entry } = await addInboxEntry({
							squadId: this.squadId,
							instanceId: this.instanceId,
							kind: args.kind,
							title: args.title,
							content: args.content,
						});
						this.logger.info(
							{ entryId: entry.id, kind: args.kind },
							'Agent created inbox entry',
						);
						return {
							textResultForLlm: JSON.stringify({
								created: true,
								id: entry.id,
								kind: entry.kind,
								title: entry.title,
								source: `squad:${this.squadName}:${this.role}`,
							}),
							resultType: 'success' as const,
						};
					} catch (err) {
						return {
							textResultForLlm: JSON.stringify({
								error: `Failed to create inbox entry: ${err instanceof Error ? err.message : String(err)}`,
							}),
							resultType: 'success' as const,
						};
					}
				},
			}),
		);

		return tools;
	}

	private emitEvent(type: AgentEvent['type'], data?: Record<string, unknown>) {
		getEventBus()
			.emit({
				id: crypto.randomUUID(),
				timestamp: new Date(),
				type,
				squadId: this.squadId,
				instanceId: this._currentInstanceId ?? this.instanceId,
				agentRole: this.role,
				model: this.model,
				data,
			})
			.catch((err) => {
				this.logger.error({ err }, 'Failed to emit agent event');
			});
	}
}

/**
 * Resolve a relative path safely within a base directory.
 * Returns null if the resolved path escapes the base.
 */
function resolveSafePath(base: string, relativePath: string): string | null {
	// Reject absolute paths outright
	if (isAbsolute(relativePath)) return null;

	const resolved = resolve(base, relativePath);
	const normalizedBase = resolve(base);

	// Ensure resolved path is within the base directory
	if (!resolved.startsWith(normalizedBase)) return null;

	return resolved;
}
