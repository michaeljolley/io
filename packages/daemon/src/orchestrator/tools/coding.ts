import { exec } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import type { ToolDefinition } from "../../copilot/session.js";

import type { OrchestratorToolExecutor } from "./squad.js";

const execAsync = promisify(exec);
const DEFAULT_ROOT = process.cwd();

const readFileSchema = z.object({
	path: z.string().trim().min(1),
});

const editFileSchema = z.object({
	path: z.string().trim().min(1),
	content: z.string(),
});

const runCommandSchema = z.object({
	command: z.string().trim().min(1),
	cwd: z.string().trim().min(1).optional(),
});

const searchCodeSchema = z.object({
	pattern: z.string().trim().min(1),
	path: z.string().trim().min(1).optional(),
	glob: z.string().trim().min(1).optional(),
});

const listFilesSchema = z.object({
	path: z.string().trim().min(1).optional(),
	pattern: z.string().trim().min(1).optional(),
});

export const codingToolDefinitions: ToolDefinition[] = [
	{
		name: "read_file",
		description: "Read a file from the local workspace.",
		parameters: readFileSchema,
		skipPermission: true,
	},
	{
		name: "edit_file",
		description: "Write full file contents to a local workspace file.",
		parameters: editFileSchema,
		skipPermission: true,
	},
	{
		name: "run_command",
		description: "Run a shell command in the local workspace.",
		parameters: runCommandSchema,
		skipPermission: true,
	},
	{
		name: "search_code",
		description: "Search code with ripgrep.",
		parameters: searchCodeSchema,
		skipPermission: true,
	},
	{
		name: "list_files",
		description: "List files in the local workspace.",
		parameters: listFilesSchema,
		skipPermission: true,
	},
];

function resolveWorkspacePath(inputPath = "."): string {
	const resolvedPath = resolve(DEFAULT_ROOT, inputPath);
	const relativePath = relative(DEFAULT_ROOT, resolvedPath);
	if (relativePath.startsWith("..") || resolve(DEFAULT_ROOT, relativePath) !== resolvedPath) {
		throw new Error(`Path is outside the workspace: ${inputPath}`);
	}
	return resolvedPath;
}

function globToRegExp(pattern: string): RegExp {
	const source = pattern
		.replace(/[\\/]+/gu, "/")
		.split("**")
		.map((part) => part.replace(/\*/gu, "[^/]*").replace(/\?/gu, "."))
		.join(".*");
	return new RegExp(`^${source}$`, "iu");
}

async function walkFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const entryPath = resolve(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkFiles(entryPath)));
			continue;
		}
		if (entry.isFile()) {
			files.push(entryPath);
		}
	}
	return files;
}

async function collectMatchingFiles(basePath: string, pattern?: string): Promise<string[]> {
	const filePaths = await walkFiles(basePath);
	if (!pattern) {
		return filePaths;
	}
	const matcher = globToRegExp(pattern);
	return filePaths.filter((filePath) =>
		matcher.test(relative(basePath, filePath).replace(/\\/gu, "/")),
	);
}

export const executeCodingToolCall: OrchestratorToolExecutor = async (toolName, rawArgs) => {
	switch (toolName) {
		case "read_file": {
			const { path } = readFileSchema.parse(rawArgs);
			const filePath = resolveWorkspacePath(path);
			const content = await readFile(filePath, "utf8");
			return { path: filePath, content };
		}
		case "edit_file": {
			const { path, content } = editFileSchema.parse(rawArgs);
			const filePath = resolveWorkspacePath(path);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, content, "utf8");
			return { message: `Wrote ${filePath}.`, path: filePath };
		}
		case "run_command": {
			const { command, cwd } = runCommandSchema.parse(rawArgs);
			const workingDirectory = cwd ? resolveWorkspacePath(cwd) : DEFAULT_ROOT;
			const { stdout, stderr } = await execAsync(command, {
				cwd: workingDirectory,
				maxBuffer: 1024 * 1024 * 4,
				timeout: 120_000,
			});
			return {
				cwd: workingDirectory,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
			};
		}
		case "search_code": {
			const { pattern, path, glob } = searchCodeSchema.parse(rawArgs);
			const basePath = resolveWorkspacePath(path ?? ".");
			const searchRoot = (await stat(basePath)).isDirectory() ? basePath : dirname(basePath);
			const args = ["--line-number", "--no-heading", pattern, searchRoot];
			if (glob) {
				args.unshift("--glob", glob);
			}
			const { stdout } = await execAsync(
				`rg ${args.map((value) => JSON.stringify(value)).join(" ")}`,
				{
					cwd: DEFAULT_ROOT,
					maxBuffer: 1024 * 1024 * 4,
					timeout: 120_000,
				},
			).catch((error: unknown) => {
				if (typeof error === "object" && error !== null && "stdout" in error) {
					return { stdout: String((error as { stdout?: unknown }).stdout ?? "") };
				}
				throw error;
			});
			return {
				root: searchRoot,
				matches: stdout.trim(),
			};
		}
		case "list_files": {
			const { path, pattern } = listFilesSchema.parse(rawArgs);
			const basePath = resolveWorkspacePath(path ?? ".");
			const stats = await stat(basePath);
			const files = stats.isDirectory()
				? await collectMatchingFiles(basePath, pattern)
				: [basePath];
			return {
				root: basePath,
				files: files.map((filePath) => relative(basePath, filePath).replace(/\\/gu, "/")),
			};
		}
		default:
			throw new Error(`Unsupported coding tool: ${toolName}`);
	}
};
