---
title: REST Endpoints
description: HTTP API reference
---

## Base URL

```
http://localhost:7777/api
```

## Authentication

When Supabase is configured with a JWT secret, all endpoints require a valid access token:

```
Authorization: Bearer <supabase-access-token>
```

**Exempt routes** (no auth required):
- `GET /api/health`
- `GET /api/config`

If Supabase is not configured, all endpoints are open.

## Endpoints

### Health

#### `GET /api/health`

Returns daemon health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "copilotConnected": true,
  "lastCheck": "2025-01-15T10:30:00.000Z"
}
```

---

### Configuration

#### `GET /api/config`

Returns the current daemon configuration (safe subset for client bootstrap).

**Response:**
```json
{
  "apiPort": 7777,
  "supabase": {
    "projectUrl": "https://your-project.supabase.co",
    "anonKey": "eyJ..."
  }
}
```

#### `PATCH /api/config`

Update configuration values at runtime. Changes are written to `~/.io/config.json`.

**Request:**
```json
{
  "logLevel": "debug",
  "defaultModel": "claude-sonnet-4.5"
}
```

---

### Conversations

#### `GET /api/conversations`

Returns the orchestrator conversation history.

**Query Parameters:**
- `limit` — Max entries (default: 50)
- `offset` — Pagination offset

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello IO!",
      "source": "web",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Messages

#### `POST /api/messages`

Send a message to the orchestrator.

**Request:**
```json
{
  "content": "Hello, IO!",
  "source": "web",
  "connectionId": "uuid-of-websocket-connection"
}
```

**Response:**
```json
{
  "status": "ok",
  "content": "Hello! How can I help you today?"
}
```

If `connectionId` is provided and the client is connected via WebSocket, streaming deltas will be sent over the WebSocket connection.

---

### Squads

#### `GET /api/squads`

List all active squads.

**Response:**
```json
{
  "squads": [
    {
      "name": "my-app",
      "projectPath": "/home/user/projects/my-app",
      "memberCount": 4,
      "instanceCount": 1
    }
  ]
}
```

#### `GET /api/squads/:name`

Get detailed squad information including members and instances.

#### `POST /api/squads/:name/run`

Start a new instance on a squad.

**Request:**
```json
{
  "objective": "Add dark mode toggle to settings page",
  "issueRef": "#42"
}
```

**Response (202 Accepted):**
```json
{
  "instanceId": "uuid",
  "status": "planning"
}
```

---

### Token Usage

#### `GET /api/usage`

Query token usage with optional filters.

**Query Parameters:**
- `squad` — Filter by squad ID
- `model` — Filter by model name
- `from` — Start date (ISO 8601)
- `to` — End date (ISO 8601)

---

### Activity

#### `GET /api/activity`

Query the agent activity log.

**Query Parameters:**
- `squad` — Filter by squad ID
- `instance` — Filter by instance ID
- `agent` — Filter by agent role
- `type` — Filter by activity type (`tool_call`, `message`, `meeting_contribution`, `task_start`, `task_complete`, `error`)
- `limit` — Max results (default: 50)
- `offset` — Pagination offset

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "squadId": "squad-123",
      "instanceId": "instance-456",
      "agentRole": "team-lead",
      "activityType": "task_start",
      "modelUsed": "claude-opus-4.6",
      "content": "{\"task\": \"implement-feature\"}",
      "tokensUsed": null,
      "timestamp": "2025-01-15T10:30:00"
    }
  ]
}
```

---

### Attachments

#### `POST /api/attachments`

Upload a file (multipart form data).

**Form Fields:**
- `file` — The file to upload (max 50MB)
- `messageId` — Optional associated message ID

**Response (201):**
```json
{
  "id": "uuid",
  "filename": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 45678
}
```

#### `GET /api/attachments/:id`

Download an attachment by ID. Returns the file with appropriate Content-Type headers.

---

### Inbox

#### `GET /api/inbox`

List inbox entries.

**Query Parameters:**
- `status` — Filter by status (`unread`, `read`)
- `kind` — Filter by kind (`deliverable`, `question`)
- `squadId` — Filter by squad ID

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "kind": "question",
      "squadId": "squad-123",
      "title": "Database choice needed",
      "body": "Should we use PostgreSQL or MySQL for the user service?",
      "status": "unread",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### `PATCH /api/inbox/:id`

Update an inbox entry (e.g., mark as read).

**Request:**
```json
{
  "status": "read"
}
```

#### `POST /api/inbox/:id/respond`

Respond to a blocking question. Unblocks the waiting squad agent.

**Request:**
```json
{
  "response": "Use PostgreSQL"
}
```

**Response:**
```json
{
  "resolved": true,
  "squadUnblocked": true
}
```

---

### Schedules

#### `GET /api/schedules`

List all configured schedules.

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "name": "Daily Standup",
      "targetType": "squad",
      "targetId": "squad-123",
      "cron": "0 9 * * 1-5",
      "prompt": "Review open issues and report progress.",
      "enabled": true,
      "nextRun": "2025-01-16T09:00:00.000Z",
      "lastRun": "2025-01-15T09:00:00.000Z"
    }
  ]
}
```

#### `POST /api/schedules`

Create a new schedule.

**Request:**
```json
{
  "name": "Daily Standup",
  "targetType": "squad",
  "targetId": "squad-uuid",
  "cron": "0 9 * * 1-5",
  "prompt": "Review open issues and report progress."
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Daily Standup",
  "cron": "0 9 * * 1-5",
  "nextRun": "2025-01-16T09:00:00.000Z"
}
```

#### `PATCH /api/schedules/:id`

Update a schedule. Updatable fields: `name`, `cron`, `prompt`, `enabled`.

**Request:**
```json
{
  "enabled": false
}
```

#### `DELETE /api/schedules/:id`

Delete a schedule.

**Response (204):** No content.

---

### Wiki

#### `GET /api/wiki/:scope`

List all pages in a wiki scope. Scope can be `io`, `shared`, or a squad name.

**Response:**
```json
{
  "scope": "shared",
  "pages": ["conventions", "architecture", "deployment"]
}
```

#### `GET /api/wiki/:scope/:page`

Read a specific wiki page.

**Response:**
```json
{
  "scope": "shared",
  "name": "conventions",
  "content": "# Conventions\n\n- Use TypeScript strict mode..."
}
```

#### `PUT /api/wiki/:scope/:page`

Write (create or overwrite) a wiki page.

**Request:**
```json
{
  "content": "# Architecture\n\nThis project uses a layered architecture..."
}
```

#### `GET /api/wiki?q=keyword&scopes=shared,my-app`

Search across wiki pages by keyword.

**Query Parameters:**
- `q` — Search keyword (required)
- `scopes` — Comma-separated scopes to search (default: `io,shared`)

**Response:**
```json
{
  "keyword": "database",
  "results": [
    {
      "scope": "shared",
      "name": "conventions",
      "matches": ["- Always use PostgreSQL for database services"]
    }
  ]
}
```
