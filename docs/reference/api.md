# API Endpoints

All API endpoints require authentication via a Supabase JWT bearer token.

```
Authorization: Bearer <supabase-jwt-token>
```

The base URL is `http://localhost:3170/api` (port configurable).

## Chat

### `POST /api/message`

Send a message to the orchestrator.

**Body:**
```json
{ "prompt": "Hello, IO!" }
```

**Response:**
```json
{ "content": "Hello! How can I help you today?" }
```

Streaming updates are delivered via the SSE connection.

### `GET /api/stream`

Server-Sent Events connection for real-time updates.

**Events:**
- `connected` — connection established
- `message_delta` — streaming message content (`{ content, done }`)

## Squads

### `GET /api/squads`

List all squads and their agents.

### `GET /api/squads/health`

Get health metrics for all squads at a glance.

**Response:**
```json
{
  "health": [
    {
      "id": "squad-id",
      "name": "Alpha Squad",
      "universe": "my-project",
      "agentCount": 3,
      "activeInstanceCount": 1,
      "activeInstances": [
        { "id": "inst-id", "branch": "feat/new-feature", "lastActivity": "2024-01-01T12:00:00" }
      ],
      "tasksTotal": 25,
      "tasksCompleted": 20,
      "tasksCompletedRecent": 5,
      "tasksPending": 2,
      "tasksInProgress": 1,
      "tasksFailed": 2,
      "avgCycleTimeMinutes": 45.2,
      "isStalled": false,
      "recentTasks": [
        { "id": "task-id", "description": "...", "status": "done", "updatedAt": "2024-01-01T12:00:00" }
      ]
    }
  ]
}
```

**Fields:**
- `tasksCompleted` — all-time completed task count
- `tasksCompletedRecent` — tasks completed in the last 7 days
- `avgCycleTimeMinutes` — average time from task creation to completion (null if no completed tasks)
- `isStalled` — true when the squad has pending/in-progress tasks that have not been updated in over 60 minutes

### `GET /api/squads/:id`

Get squad detail with agents, tasks, and instances.

## Feed

### `GET /api/feed`

List feed items.

**Query params:**
- `unread` — `"true"` to filter unread only
- `source` — filter by source
- `limit` — max items (default: 50)
- `offset` — pagination offset

### `POST /api/feed/:id/read`

Mark a feed item as read.

### `DELETE /api/feed/:id`

Delete a feed item.

## MCP Servers

### `GET /api/mcp`

List all configured MCP servers.

### `POST /api/mcp`

Add a new MCP server.

**Body:**
```json
{ "name": "My Server", "type": "stdio", "command": "npx @my/server" }
```

### `PUT /api/mcp/:id`

Update a server (enable/disable).

**Body:**
```json
{ "enabled": false }
```

### `DELETE /api/mcp/:id`

Remove a server.

## Skills

### `GET /api/skills`

List installed skills.

### `POST /api/skills`

Install or create a skill. Two modes are supported:

**Install from a git repository:**
```json
{ "url": "https://github.com/user/my-skill.git" }
```

**Create directly with markdown content:**
```json
{
  "slug": "my-skill",
  "content": "# My Skill\n\nDescribe the skill here..."
}
```

The `slug` is sanitised to lowercase alphanumeric characters and hyphens. The skill is saved to `~/.io/skills/<slug>/SKILL.md`.

### `DELETE /api/skills/:slug`

Remove an installed skill by slug.

## Wiki

### `GET /api/wiki/pages`

List all wiki page paths.

### `GET /api/wiki/page/:path`

Read a wiki page.

### `PUT /api/wiki/page/:path`

Write/update a wiki page.

**Body:**
```json
{ "content": "# My Page\n\nContent here..." }
```

### `DELETE /api/wiki/page/:path`

Delete a wiki page.

### `GET /api/wiki/search?q=query`

Search wiki pages by keyword.

## Schedules

### `GET /api/schedules`

List all schedules.

### `POST /api/schedules`

Create a schedule.

**Body:**
```json
{ "type": "io", "squad_id": "your-squad-id", "cron": "0 9 * * 1-5", "prompt": "Good morning summary" }
```

`squad_id` is required for all schedules.

### `PUT /api/schedules/:id`

Toggle a schedule.

### `DELETE /api/schedules/:id`

Delete a schedule.

## Health

### `GET /health`

Unauthenticated health check.

```json
{ "status": "ok", "version": "0.5.0" }
```
