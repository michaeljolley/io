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

Install a skill from a git repository.

**Body:**
```json
{ "url": "https://github.com/user/my-skill.git" }
```

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
