# Tools

IO exposes the following tools to the Copilot SDK orchestrator. These are invoked by the LLM during conversations.

## Wiki Tools

### `wiki_read`
Read a wiki page by path (relative to `~/.io/wiki/pages/`).

| Parameter | Type | Description |
| --- | --- | --- |
| `path` | string | Page path (e.g., `notes/todo.md`) |

### `wiki_write`
Write or update a wiki page.

| Parameter | Type | Description |
| --- | --- | --- |
| `path` | string | Page path |
| `content` | string | Markdown content |

### `wiki_list`
List all wiki pages. No parameters.

### `wiki_search`
Search wiki pages by keyword.

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | string | Search query |

### `wiki_delete`
Delete a wiki page.

| Parameter | Type | Description |
| --- | --- | --- |
| `path` | string | Page path |

## Squad Tools

### `squad_create`
Create a new project squad.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | string | Squad name |
| `universe` | string | Pop culture universe theme |
| `repo_url` | string? | Git repository URL |

### `squad_add_agent`
Add a specialist agent to a squad.

| Parameter | Type | Description |
| --- | --- | --- |
| `squad_id` | string | Squad ID |
| `character_name` | string | Character from the universe |
| `role_title` | string | Specialist role |
| `persona` | string? | Personality description |
| `is_lead` | boolean? | Team lead flag |
| `is_qa` | boolean? | QA reviewer flag |
| `is_test` | boolean? | Test specialist flag |

### `squad_list`
List all squads and their agents. No parameters.

### `squad_delegate`
Delegate a task to a squad's team lead.

| Parameter | Type | Description |
| --- | --- | --- |
| `squad_id` | string | Squad ID |
| `task` | string | Detailed task description |
| `instance_id` | string? | Instance ID for parallel work |

### `squad_task_status`
Check task status for a squad.

| Parameter | Type | Description |
| --- | --- | --- |
| `squad_id` | string | Squad ID |

### `squad_instance_create`
Create a parallel worktree instance (max 3 per squad).

| Parameter | Type | Description |
| --- | --- | --- |
| `squad_id` | string | Squad ID |
| `branch` | string | Branch name |

### `squad_instance_destroy`
Destroy a squad instance and clean up its worktree.

| Parameter | Type | Description |
| --- | --- | --- |
| `instance_id` | string | Instance ID |

## Feed Tools

### `feed_post`
Post a deliverable to the unified feed.

| Parameter | Type | Description |
| --- | --- | --- |
| `source` | string | Source identifier |
| `title` | string | Title |
| `content` | string | Full content (Markdown) |

## MCP Tools

### `mcp_list_servers`
List configured MCP servers. No parameters.

## Schedule Tools

### `schedule_create`
Create a cron-based schedule.

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `"squad"` \| `"io"` | Schedule type |
| `cron` | string | Cron expression |
| `squad_id` | string? | Squad ID (for squad schedules) |
| `agenda` | string? | Agenda type (triage, prioritize, ideation) |
| `prompt` | string? | Prompt text (for IO schedules) |
