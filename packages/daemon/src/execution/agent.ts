import { exec } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import {
	type AssistantUsageData,
	CopilotClient,
	type Tool,
	approveAll,
	defineTool,
} from "@github/copilot-sdk";
import { DEFAULT_MODEL } from "@io/shared";
import type { SquadMember, Task } from "@io/shared";

import { calculateTokenUnitCost, getModelPricing } from "../models/registry.js";
import { getSquad, recordUsage } from "../store/index.js";
import { getContextForAgent } from "./history.js";

const execAsync = promisify(exec);
const MAX_FILE_SIZE = 200_000;
const MAX_LIST_RESULTS = 200;
const MAX_SEARCH_RESULTS = 100;

export interface UsageData {
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	cost: number;
	models: string[];
}

export interface AgentExecutionResult {
	success: boolean;
	result: string;
	tokensUsed: UsageData;
}

export interface AgentToolSet {
	readFile: Tool<any>;
	editFile: Tool<any>;
	runCommand: Tool<any>;
	searchCode: Tool<any>;
	listFiles: Tool<any>;
}

function createEmptyUsage(): UsageData {
	return {
		inputTokens: 0,
		outputTokens: 0,
		reasoningTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cost: 0,
		models: [],
	};
}

function mergeUsage(target: UsageData, usage: AssistantUsageData): void {
	target.inputTokens += usage.inputTokens ?? 0;
	target.outputTokens += usage.outputTokens ?? 0;
	target.reasoningTokens += usage.reasoningTokens ?? 0;
	target.cacheReadTokens += usage.cacheReadTokens ?? 0;
	target.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
	target.cost += usage.cost ?? 0;
	if (usage.model && !target.models.includes(usage.model)) {
		target.models.push(usage.model);
	}
}

async function persistUsage(
	member: SquadMember,
	usageEvents: AssistantUsageData[],
	squadName?: string,
): Promise<void> {
	const resolvedSquadName =
		squadName ?? (member.squadId ? (await getSquad(member.squadId))?.name : null) ?? null;
	for (const usage of usageEvents) {
		const model = usage.model;
		const pricing = await getModelPricing(model);
		const cost = pricing
			? calculateTokenUnitCost(
					usage.inputTokens ?? 0,
					usage.outputTokens ?? 0,
					pricing.tokenInputMultiplier,
					pricing.tokenOutputMultiplier,
				)
			: 0;
		await recordUsage({
			squadId: member.squadId,
			squadName: resolvedSquadName,
			agentId: member.id,
			agentName: member.name,
			model,
			inputTokens: usage.inputTokens ?? 0,
			outputTokens: usage.outputTokens ?? 0,
			cost,
		});
	}
}

function ensureWithinWorktree(worktreePath: string, requestedPath: string): string {
	const candidate = isAbsolute(requestedPath)
		? resolve(requestedPath)
		: resolve(worktreePath, requestedPath);
	const relativePath = relative(worktreePath, candidate);
	if (
		relativePath.startsWith("..") ||
		relativePath.includes(`..${process.platform === "win32" ? "\\" : "/"}`)
	) {
		throw new Error(`Path ${requestedPath} escapes the worktree boundary`);
	}

	return candidate;
}

async function collectFiles(
	directory: string,
	recursive: boolean,
	output: string[],
): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (output.length >= MAX_LIST_RESULTS) {
			return;
		}

		const fullPath = join(directory, entry.name);
		output.push(fullPath);
		if (recursive && entry.isDirectory()) {
			await collectFiles(fullPath, recursive, output);
		}
	}
}

function wildcardToRegExp(pattern: string): RegExp {
	const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`, "i");
}

function serializeResult(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value, null, 2);
}

function createAgentToolSet(worktreePath: string): AgentToolSet {
	const readFileTool = defineTool("read_file", {
		description: "Read a UTF-8 text file from the agent worktree.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the file to read." },
			},
			required: ["path"],
		},
		skipPermission: true,
		handler: async (args: { path: string }) => {
			const targetPath = ensureWithinWorktree(worktreePath, args.path);
			const info = await stat(targetPath);
			if (!info.isFile()) {
				throw new Error(`${args.path} is not a file`);
			}
			if (info.size > MAX_FILE_SIZE) {
				throw new Error(`${args.path} exceeds the maximum readable size of ${MAX_FILE_SIZE} bytes`);
			}
			return readFile(targetPath, "utf8");
		},
	});

	const editFileTool = defineTool("edit_file", {
		description: "Edit a text file by replacing text or overwriting the file content.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				content: { type: "string", description: "Replace the entire file with this content." },
				search: { type: "string", description: "Text to search for before replacing." },
				replace: { type: "string", description: "Replacement text when search is provided." },
				replaceAll: { type: "boolean", description: "Replace all matches when true." },
				append: {
					type: "boolean",
					description: "Append replace/content to the file instead of overwriting.",
				},
			},
			required: ["path"],
		},
		skipPermission: true,
		handler: async (args: {
			path: string;
			content?: string;
			search?: string;
			replace?: string;
			replaceAll?: boolean;
			append?: boolean;
		}) => {
			const targetPath = ensureWithinWorktree(worktreePath, args.path);
			await mkdir(dirname(targetPath), { recursive: true });
			let nextContent = args.content ?? "";
			let previousContent = "";

			try {
				previousContent = await readFile(targetPath, "utf8");
			} catch {
				previousContent = "";
			}

			if (args.append) {
				nextContent = `${previousContent}${args.content ?? args.replace ?? ""}`;
			} else if (typeof args.search === "string") {
				if (args.replaceAll) {
					nextContent = previousContent.split(args.search).join(args.replace ?? "");
				} else {
					nextContent = previousContent.replace(args.search, args.replace ?? "");
				}
			}

			await writeFile(targetPath, nextContent, "utf8");
			return {
				path: targetPath,
				changed: previousContent !== nextContent,
			};
		},
	});

	const runCommandTool = defineTool("run_command", {
		description: "Run a shell command inside the agent worktree.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string" },
				timeoutMs: { type: "number" },
			},
			required: ["command"],
		},
		skipPermission: true,
		handler: async (args: { command: string; timeoutMs?: number }) => {
			const { stdout, stderr } = await execAsync(args.command, {
				cwd: worktreePath,
				timeout: Math.max(1_000, Math.min(args.timeoutMs ?? 60_000, 300_000)),
				maxBuffer: 10 * 1024 * 1024,
			});
			return { stdout: stdout.trim(), stderr: stderr.trim() };
		},
	});

	const searchCodeTool = defineTool("search_code", {
		description: "Search text across source files in the worktree.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string" },
				glob: { type: "string", description: "Optional wildcard pattern such as *.ts or src/*" },
				caseSensitive: { type: "boolean" },
				limit: { type: "number" },
			},
			required: ["query"],
		},
		skipPermission: true,
		handler: async (args: {
			query: string;
			glob?: string;
			caseSensitive?: boolean;
			limit?: number;
		}) => {
			const limit = Math.max(1, Math.min(args.limit ?? 20, MAX_SEARCH_RESULTS));
			const matcher = args.glob ? wildcardToRegExp(args.glob) : null;
			const searchResults: Array<{ path: string; line: number; text: string }> = [];
			const files: string[] = [];
			await collectFiles(worktreePath, true, files);
			const normalizedQuery = args.caseSensitive ? args.query : args.query.toLowerCase();

			for (const filePath of files) {
				if (searchResults.length >= limit) {
					break;
				}
				if (matcher && !matcher.test(relative(worktreePath, filePath))) {
					continue;
				}
				const fileInfo = await stat(filePath).catch(() => null);
				if (!fileInfo?.isFile() || fileInfo.size > MAX_FILE_SIZE) {
					continue;
				}
				const extension = extname(filePath).toLowerCase();
				if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".lock"].includes(extension)) {
					continue;
				}
				const content = await readFile(filePath, "utf8").catch(() => "");
				const lines = content.split(/\r?\n/);
				for (let index = 0; index < lines.length; index += 1) {
					const haystack = args.caseSensitive ? lines[index] : lines[index].toLowerCase();
					if (!haystack.includes(normalizedQuery)) {
						continue;
					}
					searchResults.push({
						path: relative(worktreePath, filePath),
						line: index + 1,
						text: lines[index],
					});
					if (searchResults.length >= limit) {
						break;
					}
				}
			}
			return searchResults;
		},
	});

	const listFilesTool = defineTool("list_files", {
		description: "List files and directories in the agent worktree.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Directory path relative to the worktree." },
				recursive: { type: "boolean" },
				limit: { type: "number" },
			},
		},
		skipPermission: true,
		handler: async (args: { path?: string; recursive?: boolean; limit?: number }) => {
			const root = ensureWithinWorktree(worktreePath, args.path ?? ".");
			const files: string[] = [];
			await collectFiles(root, args.recursive ?? false, files);
			const limit = Math.max(1, Math.min(args.limit ?? 50, MAX_LIST_RESULTS));
			return files.slice(0, limit).map((filePath) => relative(worktreePath, filePath));
		},
	});

	return {
		readFile: readFileTool,
		editFile: editFileTool,
		runCommand: runCommandTool,
		searchCode: searchCodeTool,
		listFiles: listFilesTool,
	};
}

export async function executeAgentTask(
	member: SquadMember,
	task: Task,
	worktreePath: string,
	options?: { mcpServers?: string[]; instancePromptSuffix?: string },
): Promise<AgentExecutionResult> {
	const usage = createEmptyUsage();
	const usageEvents: AssistantUsageData[] = [];
	const historyContext = await getContextForAgent(member.id).catch(
		() => "No prior task history is available for this agent.",
	);
	const toolSet = createAgentToolSet(worktreePath);
	const tools = Object.values(toolSet);
	const mcpServerNote = options?.mcpServers?.length
		? `Available MCP server labels: ${options.mcpServers.join(", ")}.`
		: "No additional MCP servers were configured for this run.";

	let client: CopilotClient | null = null;
	try {
		client = new CopilotClient({ workingDirectory: worktreePath });
		await client.start();
		const session = await client.createSession({
			model: member.model ?? DEFAULT_MODEL,
			workingDirectory: worktreePath,
			tools,
			availableTools: ["custom:*"],
			onPermissionRequest: approveAll,
			systemMessage: {
				content: `${member.systemPrompt}\n\nRecent agent history:\n${historyContext}\n\n${mcpServerNote}${options?.instancePromptSuffix ?? ""}`,
			},
		});
		session.on("assistant.usage", (event) => {
			usageEvents.push(event.data);
			mergeUsage(usage, event.data);
		});

		try {
			const response = await session.sendAndWait(
				{
					prompt: `Task title: ${task.title}\n\nTask description:\n${task.description}\n\nWork only inside the current worktree. Summarize the concrete changes you made, commands you ran, and verification results.`,
				},
				120_000,
			);
			await persistUsage(member, usageEvents);
			return {
				success: Boolean(response?.data.content?.trim()),
				result: response?.data.content?.trim() || "Agent finished without a final response.",
				tokensUsed: usage,
			};
		} finally {
			await session.disconnect().catch(() => undefined);
		}
	} catch (error) {
		await persistUsage(member, usageEvents).catch(() => undefined);
		return {
			success: false,
			result: error instanceof Error ? error.message : serializeResult(error),
			tokensUsed: usage,
		};
	} finally {
		if (client) {
			await client.stop().catch(() => []);
		}
	}
}
