import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";
import type { Tool } from "@github/copilot-sdk";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { PATHS } from "../paths.js";
import { getGhToken } from "./gh-token.js";
import type { Squad } from "../store/squads.js";

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
      description: `Read a wiki page from the squad wiki (paths are relative to your squad's wiki folder — do NOT include 'squads/${squadSlug}/' prefix)`,
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md', 'notes/architecture.md')"),
      }),
      handler: async ({ path }) => {
        const { readPage } = await import("../wiki/fs.js");
        // Strip redundant prefix if agent accidentally includes it
        const cleanPath = path.replace(new RegExp(`^(?:squads/${squadSlug}/)+`), "");
        return await readPage(`${wikiPrefix}/${cleanPath}`);
      },
    }),

    defineTool("wiki_write", {
      description: "Write or update a wiki page in the squad wiki (paths are relative — do NOT include the squad prefix)",
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md')"),
        content: z.string().describe("Markdown content to write"),
      }),
      handler: async ({ path, content }) => {
        const { writePage } = await import("../wiki/fs.js");
        // Strip redundant prefix if agent accidentally includes it
        const cleanPath = path.replace(new RegExp(`^(?:squads/${squadSlug}/)+`), "");
        await writePage(`${wikiPrefix}/${cleanPath}`, content);
        return `Page saved: ${cleanPath}`;
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
        const cleanPath = path.replace(new RegExp(`^(?:squads/${squadSlug}/)+`), "");
        await deletePage(`${wikiPrefix}/${cleanPath}`);
        return `Page deleted: ${cleanPath}`;
      },
    }),

    defineTool("wiki_backlinks", {
      description: "Find all squad wiki pages that link to the given page",
      parameters: z.object({
        path: z.string().describe("Page path (e.g., 'decisions.md')"),
      }),
      handler: async ({ path }) => {
        const { getBacklinks } = await import("../wiki/backlinks.js");
        const cleanPath = path.replace(new RegExp(`^(?:squads/${squadSlug}/)+`), "");
        const allBacklinks = await getBacklinks(`${wikiPrefix}/${cleanPath}`);
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
          // Inject cached GH token for GitHub CLI operations
          const shellEnv: Record<string, string | undefined> = { ...process.env, GH_PROMPT_DISABLED: "1" };
          const ghToken = getGhToken();
          if (ghToken) {
            shellEnv.GH_TOKEN = ghToken;
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

/**
 * Additional tools available ONLY to team leads.
 * Includes the delegate_to_specialist tool which spawns real parallel agent sessions.
 */
export function createLeadDelegationTools(
  squadId: string,
  squadSlug: string,
  squad: Squad,
  wikiKnowledge: string,
  workDir: string,
  parentTaskId: string,
  instanceId?: string
): Tool<any>[] {
  return [
    defineTool("delegate_to_specialist", {
      description:
        "Delegate a sub-task to a specialist agent. This spawns an INDEPENDENT session for that agent — they will execute the work in parallel. Use this to assign implementation work to the right specialist based on their role. You can call this multiple times to delegate to multiple specialists in parallel.",
      parameters: z.object({
        agent_name: z.string().describe("Character name of the specialist to delegate to (from your team roster)"),
        sub_task: z.string().describe("Detailed description of the sub-task. Be specific about what to implement, which files to touch, acceptance criteria, and branch to work on."),
      }),
      handler: async ({ agent_name, sub_task }) => {
        const { getAgentsForSquad } = await import("../store/squads.js");
        const agents = getAgentsForSquad(squadId);
        const agent = agents.find(
          (a) => a.character_name.toLowerCase() === agent_name.toLowerCase() && !a.is_lead
        );

        if (!agent) {
          const available = agents
            .filter((a) => !a.is_lead)
            .map((a) => `${a.character_name} (${a.role_title})`)
            .join(", ");
          return `Error: No specialist found with name "${agent_name}". Available specialists: ${available}`;
        }

        const { runSpecialistSession } = await import("./specialist-runner.js");
        const result = await runSpecialistSession({
          agent,
          squad,
          squadSlug,
          squadId,
          task: sub_task,
          wikiKnowledge,
          workDir,
          instanceId,
          parentTaskId,
        });

        if (result.success) {
          return `✅ ${result.agentName} (${result.role}) completed the task:\n\n${result.result}`;
        } else {
          return `❌ ${result.agentName} (${result.role}) failed:\n\n${result.result}`;
        }
      },
    }),

    defineTool("delegate_to_specialists_parallel", {
      description:
        "Delegate multiple sub-tasks to different specialists IN PARALLEL. All tasks run concurrently and results are returned together. Use this when multiple independent sub-tasks can be worked on simultaneously by different specialists.",
      parameters: z.object({
        assignments: z.array(z.object({
          agent_name: z.string().describe("Character name of the specialist"),
          sub_task: z.string().describe("Detailed sub-task description"),
        })).describe("Array of agent assignments to execute in parallel"),
      }),
      handler: async ({ assignments }) => {
        const { getAgentsForSquad } = await import("../store/squads.js");
        const { runSpecialistsParallel } = await import("./specialist-runner.js");
        const agents = getAgentsForSquad(squadId);

        const requests = [];
        const errors: string[] = [];

        for (const assignment of assignments) {
          const agent = agents.find(
            (a) => a.character_name.toLowerCase() === assignment.agent_name.toLowerCase() && !a.is_lead
          );
          if (!agent) {
            errors.push(`No specialist found: "${assignment.agent_name}"`);
            continue;
          }
          requests.push({
            agent,
            squad,
            squadSlug,
            squadId,
            task: assignment.sub_task,
            wikiKnowledge,
            workDir,
            instanceId,
            parentTaskId,
          });
        }

        if (requests.length === 0) {
          return `Error: No valid specialists matched. ${errors.join("; ")}`;
        }

        const results = await runSpecialistsParallel(requests);

        const summaries = results.map((r) => {
          const status = r.success ? "✅" : "❌";
          return `${status} **${r.agentName}** (${r.role}):\n${r.result}`;
        });

        const preamble = errors.length > 0 ? `⚠️ Skipped: ${errors.join("; ")}\n\n` : "";
        return `${preamble}## Parallel Results\n\n${summaries.join("\n\n---\n\n")}`;
      },
    }),
  ];
}
