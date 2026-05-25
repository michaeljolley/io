# Tools

IO exposes a set of built-in tools to the orchestrator LLM via the GitHub Copilot SDK. The model decides when to call these tools based on the user's request. All tool calls are **auto-approved** — no user confirmation is needed.

## Defining Tools

Tools are defined with the `defineTool` helper from `@github/copilot-sdk` and use [Zod](https://zod.dev/) for parameter validation:

```ts
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

const myTool = defineTool("my_tool", {
  description: "A brief description of what this tool does",
  parameters: z.object({
    input: z.string().describe("The input to process"),
  }),
  handler: async ({ input }) => {
    return `Processed: ${input}`;
  },
});
```

The `defineTool` function takes a tool name and an options object with:

- **`description`** — tells the LLM when to use this tool
- **`parameters`** — a Zod schema that validates and types the incoming arguments
- **`handler`** — an async function that receives the validated parameters and returns a string result

## Built-in Tools

All tools are created in `src/copilot/tools.ts` via the `createTools(deps)` factory. The factory receives a `ToolDeps` object that injects wiki, squad, and other service functions.

### Wiki Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `wiki_read` | Read a page from IO's knowledge base wiki | `path: string` — relative path to the wiki page |
| `wiki_write` | Write or update a page in the knowledge base | `path: string` — relative path under `pages/` ending in `.md`; `content: string` — Markdown content |
| `wiki_search` | Search the knowledge base for matching pages | `query: string` — search query |
| `wiki_list` | List all wiki pages | _(none)_ |
| `wiki_delete` | Delete a wiki page | `path: string` — relative path to the wiki page |

### Squad Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `squad_create` | Create a persistent project squad that remembers decisions and context | `slug: string` — unique identifier; `name: string` — display name; `project_path: string` — path to project directory; `universe?: string` — 80s universe theme (`a-team`, `transformers`, `thundercats`, `gi-joe`, `aliens`, `ghostbusters`). Auto-assigned if omitted. |
| `squad_analyze` | Scan a project directory and return analysis of languages, frameworks, test tools, and CI/CD configuration | `project_path: string` — path to the project directory to analyze |
| `squad_add_agent` | Add a named specialist agent to a squad. Auto-assigns the next available character from the squad's universe. | `slug: string` — squad slug; `role_title: string` — free-form role (e.g., "Frontend Architect"); `charter: string` — description of the agent's responsibilities; `model_tier?: string` — `high`, `medium`, or `low` (default: `medium`) |
| `squad_agents` | List the agent roster for a squad with character names, roles, and status | `slug: string` — squad slug |
| `squad_remove_agent` | Remove a named agent from a squad | `slug: string` — squad slug; `character_name: string` — the character name of the agent to remove |
| `squad_reset_agent` | Clear an agent's error state and return them to `idle` without removing them. Preserves charter, role title, character name, and lead/QA flags. Drops the cached Copilot session so the next task starts fresh. Safe no-op on non-error agents. | `slug: string` — squad slug; `character_name: string` — character name of the agent to reset |
| `squad_recall` | Recall a squad's context and past decisions | `slug: string` — squad slug |
| `squad_status` | List all squads and their status | _(none)_ |
| `squad_log_decision` | Log an important decision for a squad | `slug: string` — squad slug; `decision: string` — the decision made; `context?: string` — reasoning |
| `squad_delegate` | Delegate a task to a squad's worker agent | `slug: string` — squad slug; `task: string` — the task to delegate; `agent?: string` — character name of a specific agent to target (e.g., `"Hannibal"`, `"Optimus Prime"`) |
| `squad_set_lead` | Designate an agent as the squad's team lead. The lead must be a **dedicated PM / Senior Engineer with no domain responsibility** — their sole job is coordinating, delegating, and reviewing. The lead automatically holds veto power on PR promotion. | `slug: string` — squad slug; `character_name: string` — character name of the agent to make team lead |
| `squad_set_qa` | Mark a squad agent as a QA reviewer with veto power. QA agents must approve before a PR is promoted from draft to ready. | `slug: string` — squad slug; `character_name: string` — character name of the agent; `is_qa: boolean` — whether this agent is a QA reviewer |
| `squad_task_reviews` | Get the peer reviews left on a completed task. Reviewers tagged ⭐ (lead) and 🛡️ (QA) hold veto power — any rejection from either blocks PR promotion. | `task_id: string` — the task ID to fetch reviews for |
| `squad_delete` | Delete a squad | `slug: string` — squad slug |

#### Available Universes

When creating a squad, you can optionally specify one of six 80s pop culture universes. Each universe provides a pool of characters that are assigned to agents in order:

| Universe | Characters |
| --- | --- |
| `a-team` | Hannibal, Face, B.A. Baracus, Murdock, Amy Allen, Frankie Santana |
| `transformers` | Optimus Prime, Bumblebee, Ratchet, Prowl, Wheeljack, Jazz, Ironhide, Grimlock |
| `thundercats` | Lion-O, Tygra, Panthro, Cheetara, WilyKit, WilyKat, Snarf |
| `gi-joe` | Duke, Scarlett, Snake Eyes, Flint, Lady Jaye, Breaker, Doc, Roadblock |
| `aliens` | Ripley, Hicks, Bishop, Vasquez, Hudson, Newt, Apone, Drake |
| `ghostbusters` | Venkman, Egon, Ray, Winston, Janine, Louis, Dana, Gozer |

Each character comes with a personality description that influences the agent's communication style in its responses.

#### Squad Coverage Warnings

`squad_status`, `squad_agents`, and `squad_delegate` surface a ⚠️ warning when any of the following are missing:

- A **dedicated team lead** designated via `squad_set_lead` whose role is coordination-only (PM / Senior Engineer with no domain responsibility). The warning also fires if a lead is set but their role title looks like a domain specialist (e.g. "Frontend Lead", "Test Manager").
- A **QA reviewer** designated via `squad_set_qa`.
- A **test/quality engineer** — an agent whose `role_title` contains `test`, `qa`, or `quality`.

Delegation is not blocked by these warnings, but the gap should be fixed before promoting work. The team lead, QA reviewers, and test engineers (when designated as QA) all hold veto power on PR promotion — any rejection from any of them keeps the PR as a draft.

### MCP Management Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `mcp_server_list` | List configured MCP servers with enabled/disabled status | _(none)_ |
| `mcp_server_add` | Add a new MCP server | `name: string`; `command?: string`; `args?: string[]`; `url?: string`; `env?: Record<string, string>` |
| `mcp_server_remove` | Remove an MCP server by name | `name: string` |
| `mcp_server_toggle` | Enable or disable an MCP server | `name: string` |
| `mcp_server_reload` | Hot-reload MCP tools after config changes (without restarting IO) | _(none)_ |

### Scheduling Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `schedule_create` | Create a scheduled task (cron) | `name: string`; `cron: string` — cron expression; `task: string`; `enabled?: boolean` |
| `schedule_list` | List all IO-level schedules | _(none)_ |
| `schedule_delete` | Delete a schedule | `name: string` |
| `schedule_pause` | Pause a schedule | `name: string` |
| `schedule_resume` | Resume a paused schedule | `name: string` |
| `schedule_run_now` | Immediately trigger a schedule | `name: string` |

Squad-scoped equivalents (`squad_schedule_create`, `squad_schedule_list`, etc.) follow the same signatures but require a `slug: string` parameter and are scoped to a specific squad.

### Squad Instance Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `squad_instance_create` | Create a parallel git worktree instance for concurrent work | `slug: string`; `issue_ref?: string` |
| `squad_instance_list` | List all instances for a squad | `slug: string` |
| `squad_instance_status` | Get the status and details of an instance | `instance_id: string` |
| `squad_instance_complete` | Complete an instance and merge its decisions back to the master squad | `instance_id: string` |
| `squad_instance_abort` | Abort an active instance | `instance_id: string` |
| `squad_instance_cleanup` | Remove an instance's git worktree | `instance_id: string` |
| `squad_instance_activate` | Set the active instance context for subsequent tool calls | `instance_id: string` |
| `squad_instance_deactivate` | Clear the active instance context | _(none)_ |

### Feed & Inbox Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `send_to_inbox` | Send a message directly to the user's inbox | `title: string`; `body: string`; `squad_slug?: string` |
| `send_notification` | Create a notification in the activity feed | `title: string`; `body: string`; `source_type?: string` |

### File & Code Tools

These tools are available to squad agents for reading and modifying project files:

| Tool | Description | Parameters |
| --- | --- | --- |
| `bash` | Run a bash command | `command: string`; `timeout_secs?: number`; `working_dir?: string` |
| `read_file` | Read the full contents of a file | `path: string` |
| `view` | View a file or directory with line numbers | `path: string`; `view_range?: [number, number]` |
| `grep` | Search file contents using a regex pattern | `pattern: string`; `path?: string`; `include?: string` |
| `str_replace_editor` | Make a precise string replacement in a file | `path: string`; `old_str: string`; `new_str: string` |

### Configuration Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `config_update` | Update a key in IO's configuration | `key: string`; `value: unknown` |
| `check_update` | Check for and apply available IO updates | _(none)_ |

### Shell

| Tool | Description | Parameters |
| --- | --- | --- |
| `shell` | Run a shell command on the user's machine | `command: string` — the command to run; `timeout_secs?: number` — timeout in seconds (default: 60); `working_dir?: string` — working directory |

::: warning
Shell commands execute with the IO process's permissions. Output is truncated to 8 000 characters.
:::

### Web

| Tool | Description | Parameters |
| --- | --- | --- |
| `web_fetch` | Fetch a URL and return its content as text | `url: string` — URL to fetch; `max_length?: number` — max characters to return (default: 5 000) |

### File Operations

| Tool | Description | Parameters |
| --- | --- | --- |
| `file_ops` | Read, write, or list files on the local filesystem | `operation: "read" \| "write" \| "list"` — operation to perform; `path: string` — file or directory path; `content?: string` — content to write; `recursive?: boolean` — recurse into subdirectories |

### GitHub

| Tool | Description | Parameters |
| --- | --- | --- |
| `github` | Interact with GitHub (issues, PRs, comments) via `gh` CLI | `command: string` — the `gh` CLI command to run |

### Skills

| Tool | Description | Parameters |
| --- | --- | --- |
| `skill_list` | List installed skills | _(none)_ |
| `skill_install` | Install a skill from a git repo | `repo_url: string` — git repository URL |
| `skill_remove` | Remove an installed skill | `slug: string` — skill slug |
| `skill_search` | Search the skills.sh registry | `query: string` — search query |

### Configuration

| Tool | Description | Parameters |
| --- | --- | --- |
| `config_update` | Update an IO configuration value at runtime | `key: string` — config key; `value: string` — new value |

### System

| Tool | Description | Parameters |
| --- | --- | --- |
| `check_update` | Check for and apply IO updates | _(none)_ |

## Adding a New Tool

1. **Define the tool** in `src/copilot/tools.ts` inside the `createTools()` function using `defineTool`:

```ts
const myTool = defineTool("my_tool", {
  description: "Describe what this tool does",
  parameters: z.object({
    input: z.string().describe("The input to process"),
  }),
  handler: async ({ input }) => {
    // Your logic here
    return `Result: ${input}`;
  },
});
```

2. **Add it to the returned array** at the bottom of `createTools()`:

```ts
return [
  wikiRead, wikiWrite, wikiSearch,
  squadCreate, squadRecall, squadStatus, squadLogDecision,
  shell, webFetch, fileOps,
  myTool,  // ← add here
];
```

That's it — the orchestrator automatically picks up every tool in the array and exposes it to the LLM.

### Tips

- **Name**: Use `snake_case` — this is the identifier the LLM uses to call the tool
- **Description**: Be specific — the LLM relies on this to decide when your tool is relevant
- **Parameters**: Use Zod's `.describe()` on each field so the model knows what to pass
- **Error handling**: Return an error string from the handler; the LLM will see the message and can retry or adjust

## Tool Permissions

Tools execute with the same permissions as the IO process. When running as a daemon, ensure the process user has only the access it needs.
