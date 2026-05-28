import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";
import type { Tool } from "@github/copilot-sdk";
import { addAuditEntry } from "../store/audit-log.js";

export function createTools(): Tool<any>[] {
  return [
    // --- Wiki Tools ---
    defineTool("wiki_read", {
      description: "Read a wiki page by path (relative to ~/.io/wiki/pages/)",
      parameters: z.object({
        path: z.string().describe("Page path relative to pages/ (e.g., 'notes/todo.md')"),
      }),
      handler: async ({ path }) => {
        const { readPage } = await import("../wiki/fs.js");
        return await readPage(path);
      },
    }),

    defineTool("wiki_write", {
      description: "Write or update a wiki page",
      parameters: z.object({
        path: z.string().describe("Page path relative to pages/"),
        content: z.string().describe("Markdown content to write"),
      }),
      handler: async ({ path, content }) => {
        const { writePage } = await import("../wiki/fs.js");
        await writePage(path, content);
        return `Page saved: ${path}`;
      },
    }),

    defineTool("wiki_list", {
      description: "List all wiki pages",
      parameters: z.object({}),
      handler: async () => {
        const { listPages } = await import("../wiki/fs.js");
        return await listPages();
      },
    }),

    defineTool("wiki_search", {
      description: "Search wiki pages by keyword",
      parameters: z.object({
        query: z.string().describe("Search query"),
      }),
      handler: async ({ query }) => {
        const { searchPages } = await import("../wiki/search.js");
        return await searchPages(query);
      },
    }),

    defineTool("wiki_delete", {
      description: "Delete a wiki page",
      parameters: z.object({
        path: z.string().describe("Page path relative to pages/"),
      }),
      handler: async ({ path }) => {
        const { deletePage } = await import("../wiki/fs.js");
        await deletePage(path);
        return `Page deleted: ${path}`;
      },
    }),

    defineTool("wiki_backlinks", {
      description: "Find all wiki pages that link to the given page",
      parameters: z.object({
        path: z.string().describe("Page path relative to pages/ (e.g., 'notes/todo.md')"),
      }),
      handler: async ({ path }) => {
        const { getBacklinks } = await import("../wiki/backlinks.js");
        return await getBacklinks(path);
      },
    }),

    // --- Squad Tools ---
    defineTool("squad_create", {
      description:
        "Create a new project squad. Research the chosen universe to assign character names — never hardcode.",
      parameters: z.object({
        name: z.string().describe("Squad name (e.g., 'Project Alpha')"),
        universe: z
          .string()
          .describe("Pop culture universe theme (e.g., 'A-Team', 'Transformers', 'ThunderCats')"),
        repo_url: z.string().optional().describe("Git repository URL for the project"),
      }),
      handler: async ({ name, universe, repo_url }) => {
        const { createSquad } = await import("../store/squads.js");
        const squad = createSquad(name, universe, repo_url);
        let cloneMsg = "";

        // Copy squad wiki templates into the new squad's wiki directory
        const { copySquadTemplates } = await import("../wiki/fs.js");
        await copySquadTemplates(squad.slug);

        if (repo_url) {
          const { exec } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const { existsSync, mkdirSync } = await import("node:fs");
          const { join } = await import("node:path");
          const { PATHS } = await import("../paths.js");
          const execAsync = promisify(exec);

          // Extract owner/repo from URL (supports https and git@ formats)
          const match = repo_url.match(/[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
          if (match) {
            const [, owner, repo] = match;
            const sourceDir = join(PATHS.source, owner, repo);
            if (!existsSync(sourceDir)) {
              const parentDir = join(PATHS.source, owner);
              if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
              try {
                await execAsync(`git clone ${repo_url} ${sourceDir}`, {
                  timeout: 120_000,
                });
                cloneMsg = ` Repo cloned to ~/.io/source/${owner}/${repo}.`;
              } catch (err: any) {
                cloneMsg = ` (Clone failed: ${err.stderr?.trim() || err.message})`;
              }
            } else {
              cloneMsg = ` Repo already exists at ~/.io/source/${owner}/${repo}.`;
            }
          }
        }

        const msg = `Squad "${name}" created with universe "${universe}". ID: ${squad.id}, Slug: ${squad.slug}. Wiki path: ~/.io/wiki/squads/${squad.slug}/${cloneMsg}`;
        addAuditEntry(
          "squad_created",
          `Squad "${name}" created (universe: ${universe})`,
          { squad_id: squad.id, name, universe, repo_url },
          { squad_id: squad.id }
        );
        return msg;
      },
    }),

    defineTool("squad_add_agent", {
      description: "Add a specialist agent to a squad",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
        character_name: z.string().describe("Character name from the squad's universe"),
        role_title: z.string().describe("Specialist role (e.g., 'Vue 3 Frontend Developer')"),
        persona: z.string().optional().describe("Personality/work style description"),
        is_lead: z.boolean().optional().describe("Is this the team lead?"),
        is_qa: z.boolean().optional().describe("Is this a QA reviewer?"),
        is_test: z.boolean().optional().describe("Is this a test/quality specialist?"),
      }),
      handler: async ({ squad_id, character_name, role_title, persona, is_lead, is_qa, is_test }) => {
        const { addAgent } = await import("../store/squads.js");
        const agent = addAgent(squad_id, {
          character_name,
          role_title,
          persona: persona ?? "",
          is_lead: is_lead ?? false,
          is_qa: is_qa ?? false,
          is_test: is_test ?? false,
        });
        return `Agent "${character_name}" (${role_title}) added to squad. ID: ${agent.id}`;
      },
    }),

    defineTool("squad_list", {
      description: "List all squads and their agents",
      parameters: z.object({}),
      handler: async () => {
        const { listSquads } = await import("../store/squads.js");
        return listSquads();
      },
    }),

    defineTool("squad_delegate", {
      description:
        "Delegate a task to a squad's team lead. The lead will break it down and route to specialists. Use this for direct execution without a planning meeting.",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
        task: z.string().describe("Detailed task description"),
        instance_id: z.string().optional().describe("Instance ID (for parallel work)"),
      }),
      handler: async ({ squad_id, task, instance_id }) => {
        const { delegateTask } = await import("./agents.js");
        const { getActiveMessageAttachments } = await import("./orchestrator.js");
        const attachments = getActiveMessageAttachments();
        addAuditEntry(
          "task_delegated",
          `Task delegated to squad ${squad_id}: ${task.slice(0, 200)}`,
          {
            squad_id,
            task: task.slice(0, 1000),
            instance_id,
            attachments: attachments.map((attachment) => ({
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
            })),
          },
          { squad_id }
        );
        const result = await delegateTask(squad_id, task, instance_id, attachments);
        return result;
      },
    }),

    defineTool("squad_meeting", {
      description:
        "Trigger a planning meeting for a squad. All relevant specialists provide input before work begins. Use this for complex multi-agent tasks where team input improves the plan. Set execute_after=true to start work immediately after planning, or false to post the plan to the feed for user review.",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
        task: z.string().describe("Detailed task description for the team to plan"),
        execute_after: z
          .boolean()
          .describe("If true, execute the plan immediately after the meeting. If false, post plan to feed and wait for user approval."),
      }),
      handler: async ({ squad_id, task, execute_after }) => {
        const { squadMeeting } = await import("./ceremonies.js");
        const { getActiveMessageAttachments } = await import("./orchestrator.js");
        const attachments = getActiveMessageAttachments();
        addAuditEntry(
          "squad_meeting",
          `Planning meeting started for squad ${squad_id}: ${task.slice(0, 200)}`,
          {
            squad_id,
            task: task.slice(0, 1000),
            execute_after,
            attachments: attachments.map((attachment) => ({
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
            })),
          },
          { squad_id }
        );
        return await squadMeeting(squad_id, task, execute_after, attachments);
      },
    }),

    defineTool("squad_task_status", {
      description: "Check the status of tasks for a squad",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
      }),
      handler: async ({ squad_id }) => {
        const { getTasksForSquad } = await import("../store/tasks.js");
        return getTasksForSquad(squad_id);
      },
    }),

    defineTool("squad_instance_create", {
      description: "Create a new parallel instance (worktree) for a squad. Max 3 per squad.",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
        branch: z.string().describe("Branch name for the worktree"),
      }),
      handler: async ({ squad_id, branch }) => {
        const { createInstance } = await import("../store/instances.js");
        const instance = await createInstance(squad_id, branch);
        return `Instance created: ${instance.id} on branch ${branch}`;
      },
    }),

    defineTool("squad_instance_destroy", {
      description: "Destroy a squad instance and clean up its worktree",
      parameters: z.object({
        instance_id: z.string().describe("Instance ID"),
      }),
      handler: async ({ instance_id }) => {
        const { destroyInstance } = await import("../store/instances.js");
        await destroyInstance(instance_id);
        return `Instance ${instance_id} destroyed.`;
      },
    }),

    defineTool("squad_remove_agent", {
      description: "Remove an agent from a squad",
      parameters: z.object({
        agent_id: z.string().describe("Agent ID to remove"),
      }),
      handler: async ({ agent_id }) => {
        const { removeAgent } = await import("../store/squads.js");
        removeAgent(agent_id);
        return `Agent ${agent_id} removed.`;
      },
    }),

    defineTool("squad_delete", {
      description: "Delete an entire squad and all its agents, tasks, and instances",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID to delete"),
      }),
      handler: async ({ squad_id }) => {
        const { deleteSquad } = await import("../store/squads.js");
        deleteSquad(squad_id);
        return `Squad ${squad_id} deleted.`;
      },
    }),

    // --- Feed Tools ---
    defineTool("feed_post", {
      description: "Post a deliverable to the unified feed/inbox",
      parameters: z.object({
        source: z.string().describe("Source identifier (e.g., 'orchestrator', 'squad-alpha')"),
        title: z.string().describe("Title of the deliverable"),
        content: z.string().describe("Full content (markdown supported)"),
      }),
      handler: async ({ source, title, content }) => {
        const { postFeedItem } = await import("../store/feed.js");
        const item = postFeedItem(source, title, content);
        return `Posted to feed: "${title}" (ID: ${item.id})`;
      },
    }),

    defineTool("feed_list", {
      description: "List feed/inbox items. Can filter by unread or source.",
      parameters: z.object({
        unread_only: z.boolean().optional().describe("Only show unread items"),
        source: z.string().optional().describe("Filter by source"),
        limit: z.number().optional().describe("Max items to return (default 20)"),
      }),
      handler: async ({ unread_only, source, limit }) => {
        const { getFeedItems } = await import("../store/feed.js");
        return getFeedItems({ unreadOnly: unread_only, source, limit: limit ?? 20 });
      },
    }),

    // --- MCP Tools ---
    defineTool("mcp_list_servers", {
      description: "List configured MCP servers and their status",
      parameters: z.object({}),
      handler: async () => {
        const { listServers } = await import("../mcp/registry.js");
        return listServers();
      },
    }),

    // --- Schedule Tools ---
    defineTool("schedule_create", {
      description: "Create a cron-based schedule",
      parameters: z.object({
        type: z.enum(["squad", "io"]).describe("Schedule type"),
        cron: z.string().describe("Cron expression (e.g., '0 9 * * 1-5')"),
        squad_id: z.string().describe("Target squad ID"),
        agenda: z
          .string()
          .optional()
          .describe("Agenda type for squad schedules (triage, prioritize, ideation, or custom)"),
        prompt: z.string().optional().describe("Prompt text for the schedule"),
      }),
      handler: async ({ type, cron, squad_id, agenda, prompt }) => {
        const { createSchedule } = await import("../store/schedules.js");
        const schedule = createSchedule({ type, cron, squad_id, agenda, prompt });
        return `Schedule created: ${schedule.id}`;
      },
    }),

    defineTool("schedule_list", {
      description: "List all schedules, optionally filtered by type",
      parameters: z.object({
        type: z.enum(["squad", "io"]).optional().describe("Filter by schedule type"),
      }),
      handler: async ({ type }) => {
        const { listSchedules } = await import("../store/schedules.js");
        return listSchedules(type);
      },
    }),

    defineTool("schedule_delete", {
      description: "Delete a schedule by ID",
      parameters: z.object({
        id: z.string().describe("Schedule ID to delete"),
      }),
      handler: async ({ id }) => {
        const { deleteSchedule } = await import("../store/schedules.js");
        deleteSchedule(id);
        return `Schedule ${id} deleted.`;
      },
    }),

    defineTool("schedule_update", {
      description: "Update an existing schedule's cron, agenda, prompt, or enabled status",
      parameters: z.object({
        id: z.string().describe("Schedule ID to update"),
        cron: z.string().optional().describe("New cron expression"),
        agenda: z.string().optional().describe("New agenda text"),
        prompt: z.string().optional().describe("New prompt text"),
        enabled: z.boolean().optional().describe("Enable or disable the schedule"),
      }),
      handler: async ({ id, cron, agenda, prompt, enabled }) => {
        const { updateSchedule } = await import("../store/schedules.js");
        const schedule = updateSchedule(id, { cron, agenda, prompt, enabled });
        return `Schedule ${id} updated. Cron: ${schedule.cron}, Enabled: ${!!schedule.enabled}`;
      },
    }),

    // --- Shell Tool ---
    defineTool("shell_exec", {
      description:
        "Execute a shell command on the host machine. Use for git, gh CLI, file operations, etc. Commands run in the user's environment with their credentials.",
      parameters: z.object({
        command: z.string().describe("Shell command to execute"),
        cwd: z.string().optional().describe("Working directory (defaults to home directory)"),
      }),
      handler: async ({ command, cwd }) => {
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const { homedir } = await import("node:os");
        const execAsync = promisify(exec);

        // Ensure GitHub CLI auth is available in the shell environment
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
            // gh auth not available
          }
        }

        try {
          const { stdout } = await execAsync(command, {
            cwd: cwd ?? homedir(),
            timeout: 60_000,
            maxBuffer: 1024 * 1024,
            env: shellEnv,
          });
          const output = stdout.trim() || "(no output)";
          addAuditEntry(
            "shell_command",
            `Command: ${command.slice(0, 200)}`,
            { command, cwd, output: output.slice(0, 500), exit_code: 0 }
          );
          return output;
        } catch (err: any) {
          const stderr = err.stderr?.toString().trim() ?? "";
          const stdout = err.stdout?.toString().trim() ?? "";
          const output = `Error (exit ${err.code}): ${stderr || stdout || err.message}`;
          addAuditEntry(
            "shell_command",
            `Command: ${command.slice(0, 200)}`,
            { command, cwd, output: output.slice(0, 500), exit_code: err.code ?? 1 }
          );
          return output;
        }
      },
    }),

    // --- Web Tools ---
    // NOTE: web_search and web_fetch are provided by the Copilot SDK as built-in tools.
    // Do not define them here to avoid conflicts.
  ];
}
