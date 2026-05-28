import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";
import type { Tool } from "@github/copilot-sdk";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { PATHS } from "../paths.js";

const execAsync = promisify(exec);

/**
 * Resolve the project root directory for a squad from its repo_url.
 * Returns the path under ~/.io/source/{owner}/{repo} or null if unknown.
 */
function resolveSquadProjectDir(repoUrl: string | null): string | null {
  if (!repoUrl) return null;
  const match = repoUrl.match(/[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) return null;
  const [, owner, repo] = match;
  return join(PATHS.source, owner, repo);
}

/**
 * Creates a scoped set of tools for squad agent sessions.
 * Wiki tools are sandboxed to the squad's own wiki subfolder.
 * Feed posts are locked to the squad's source identifier.
 */
export function createSquadTools(squadSlug: string, squadId: string, repoUrl?: string | null): Tool<any>[] {
  const wikiPrefix = `squads/${squadSlug}`;
  const projectDir = resolveSquadProjectDir(repoUrl ?? null);

  return [
    // --- Wiki Tools (scoped to squads/{slug}/) ---
    defineTool("wiki_read", {
      description: `Read a wiki page from the squad wiki (paths are relative to your squad's wiki folder)`,
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md', 'notes/architecture.md')"),
      }),
      handler: async ({ path }) => {
        const { readPage } = await import("../wiki/fs.js");
        return await readPage(`${wikiPrefix}/${path}`);
      },
    }),

    defineTool("wiki_write", {
      description: "Write or update a wiki page in the squad wiki",
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md')"),
        content: z.string().describe("Markdown content to write"),
      }),
      handler: async ({ path, content }) => {
        const { writePage } = await import("../wiki/fs.js");
        await writePage(`${wikiPrefix}/${path}`, content);
        return `Page saved: ${path}`;
      },
    }),

    defineTool("wiki_list", {
      description: "List all wiki pages in the squad wiki",
      parameters: z.object({}),
      handler: async () => {
        const { listPages } = await import("../wiki/fs.js");
        return await listPages(wikiPrefix);
      },
    }),

    defineTool("wiki_search", {
      description: "Search squad wiki pages by keyword",
      parameters: z.object({
        query: z.string().describe("Search query"),
      }),
      handler: async ({ query }) => {
        const { searchSquadPages } = await import("../wiki/search.js");
        return await searchSquadPages(query, wikiPrefix);
      },
    }),

    defineTool("wiki_delete", {
      description: "Delete a wiki page from the squad wiki",
      parameters: z.object({
        path: z.string().describe("Page path to delete"),
      }),
      handler: async ({ path }) => {
        const { deletePage } = await import("../wiki/fs.js");
        await deletePage(`${wikiPrefix}/${path}`);
        return `Page deleted: ${path}`;
      },
    }),

    defineTool("wiki_backlinks", {
      description: "Find all squad wiki pages that link to the given page",
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md')"),
      }),
      handler: async ({ path }) => {
        const { getBacklinks } = await import("../wiki/backlinks.js");
        const allBacklinks = await getBacklinks(`${wikiPrefix}/${path}`);
        // Filter to only show backlinks within squad wiki, strip prefix for display
        return allBacklinks
          .filter((bl) => bl.startsWith(`${wikiPrefix}/`))
          .map((bl) => bl.slice(wikiPrefix.length + 1));
      },
    }),

    // --- Feed Tools ---
    defineTool("feed_post", {
      description:
        "Post a message or deliverable to the user's inbox. Use for progress updates, questions, blockers, or completed work.",
      parameters: z.object({
        title: z.string().describe("Title of the message"),
        content: z.string().describe("Full content (markdown supported)"),
      }),
      handler: async ({ title, content }) => {
        const { postFeedItem } = await import("../store/feed.js");
        const source = `squad-${squadSlug}`;
        const item = postFeedItem(source, title, content);
        return `Posted to inbox: "${title}" (ID: ${item.id})`;
      },
    }),

    // --- Task Tools ---
    defineTool("squad_task_status", {
      description: "Check the status of tasks for your squad",
      parameters: z.object({}),
      handler: async () => {
        const { getTasksForSquad } = await import("../store/tasks.js");
        return getTasksForSquad(squadId);
      },
    }),

    // --- Shell Tool (scoped to project directory) ---
    defineTool("shell_exec", {
      description:
        "Execute a shell command in the squad's project directory. Use for git, build tools, test runners, file operations, etc.",
      parameters: z.object({
        command: z.string().describe("Shell command to execute"),
        cwd: z
          .string()
          .optional()
          .describe(
            "Working directory relative to project root (optional, defaults to project root)"
          ),
      }),
      handler: async ({ command, cwd }) => {
        const baseDir = projectDir ?? process.cwd();
        // If cwd is provided, resolve it relative to the project dir
        const workDir = cwd ? join(baseDir, cwd) : baseDir;

        // Safety: ensure workDir is under baseDir
        const resolved = join(workDir);
        if (!resolved.startsWith(baseDir)) {
          return `Error: cannot execute commands outside the project directory`;
        }

        try {
          // Ensure GitHub CLI auth is available — prefer GH_TOKEN from env,
          // fall back to extracting from gh auth if available
          const shellEnv: Record<string, string | undefined> = { ...process.env, GH_PROMPT_DISABLED: "1" };
          if (!shellEnv.GH_TOKEN && !shellEnv.GITHUB_TOKEN) {
            try {
              const { stdout: token } = await execAsync("gh auth token", {
                timeout: 5_000,
                env: process.env,
              });
              if (token.trim()) {
                shellEnv.GH_TOKEN = token.trim();
              }
            } catch {
              // gh auth not available — agents won't be able to push
            }
          }

          const { stdout } = await execAsync(command, {
            cwd: workDir,
            timeout: 120_000,
            maxBuffer: 2 * 1024 * 1024,
            env: shellEnv,
          });
          return stdout.trim() || "(no output)";
        } catch (err: any) {
          const stderr = err.stderr?.toString().trim() ?? "";
          const stdout = err.stdout?.toString().trim() ?? "";
          return `Error (exit ${err.code ?? 1}): ${stderr || stdout || err.message}`;
        }
      },
    }),
  ];
}
