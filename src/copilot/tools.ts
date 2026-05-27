import { z } from "zod";
import { defineTool } from "@github/copilot-sdk";
import type { Tool } from "@github/copilot-sdk";

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
        return `Squad "${name}" created with universe "${universe}". ID: ${squad.id}`;
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
        "Delegate a task to a squad's team lead. The lead will break it down and route to specialists.",
      parameters: z.object({
        squad_id: z.string().describe("Squad ID"),
        task: z.string().describe("Detailed task description"),
        instance_id: z.string().optional().describe("Instance ID (for parallel work)"),
      }),
      handler: async ({ squad_id, task, instance_id }) => {
        const { delegateTask } = await import("./agents.js");
        const result = await delegateTask(squad_id, task, instance_id);
        return result;
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
        squad_id: z.string().optional().describe("Squad ID (required for squad schedules)"),
        agenda: z
          .string()
          .optional()
          .describe("Agenda type for squad schedules (triage, prioritize, ideation, or custom)"),
        prompt: z.string().optional().describe("Prompt text for IO schedules"),
      }),
      handler: async ({ type, cron, squad_id, agenda, prompt }) => {
        const { createSchedule } = await import("../store/schedules.js");
        const schedule = createSchedule({ type, cron, squad_id, agenda, prompt });
        return `Schedule created: ${schedule.id}`;
      },
    }),
  ];
}
