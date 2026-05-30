---
title: Configuration
description: Configuring IO's behavior
---

IO uses a layered configuration system. **Environment variables** take priority over the **config file**, which takes priority over **defaults**.

## Config File

Create `~/.io/config.json` with any settings you want to override:

```json
{
  "apiPort": 7777,
  "logLevel": "info",
  "defaultModel": "claude-opus-4.6",
  "maxInstancesPerSquad": 3,
  "telegram": {
    "botToken": "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ",
    "allowedChatIds": [12345678, 87654321]
  },
  "supabase": {
    "projectUrl": "https://your-project.supabase.co",
    "anonKey": "eyJhbGciOiJIUzI1NiIs...",
    "jwtSecret": "your-jwt-secret-from-supabase-settings"
  }
}
```

All fields are optional — only specify what you want to change from defaults.

## Environment Variables

Environment variables override config file values:

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `IO_PORT` | `apiPort` | `7777` | HTTP/WebSocket server port |
| `IO_LOG_LEVEL` | `logLevel` | `info` | Log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `IO_MODEL` | `defaultModel` | `claude-opus-4.6` | Default LLM model |
| `IO_DATA_DIR` | `dataDir` | `~/.io` | Base directory for all IO data |
| `TELEGRAM_BOT_TOKEN` | `telegram.botToken` | — | Telegram bot token from @BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | `telegram.allowedChatIds` | — | Comma-separated chat IDs to whitelist |
| `IO_SUPABASE_URL` | `supabase.projectUrl` | — | Supabase project URL |
| `IO_SUPABASE_ANON_KEY` | `supabase.anonKey` | — | Supabase publishable anon key |
| `IO_SUPABASE_JWT_SECRET` | `supabase.jwtSecret` | — | Supabase JWT secret for API auth |

## Authentication (Supabase)

When `supabase.projectUrl` and `supabase.anonKey` are set, the web dashboard shows a login page and requires authentication. When `supabase.jwtSecret` is also set, all API endpoints (except `GET /api/health` and `GET /api/config`) require a valid JWT in the `Authorization: Bearer <token>` header.

If Supabase is **not** configured, authentication is skipped entirely — suitable for local-only use behind a firewall.

## Data Directory

```
~/.io/
├── config.json          # Configuration overrides
├── io.db                # SQLite database
├── attachments/         # Uploaded files
│   └── {id}/
│       └── {filename}
├── source/              # Cloned project repos
│   └── {owner}/
│       └── {repo}/
├── squads/
│   └── {squad-name}/
│       ├── team-lead.skill.md
│       ├── scribe.skill.md
│       ├── qa-tester.skill.md
│       └── {specialist}.skill.md
├── wiki/                # Knowledge base pages
│   ├── io/
│   ├── shared/
│   └── squads/{name}/
└── sessions/            # Copilot SDK session state
```

### Source Directory Convention

When the orchestrator clones repos for squad work, they are stored at `~/.io/source/{owner}/{repo}`. For example, `https://github.com/microsoft/powertoys` is cloned to `~/.io/source/microsoft/powertoys`.

## Autonomy Tiers

Each squad has an autonomy tier that controls what actions it can take without human approval:

```json
{
  "low": {
    "canMergePrs": false,
    "canCreateReleases": false,
    "canCloseIssues": false,
    "canSelfReview": false,
    "requiresUserApprovalFor": ["merge", "release", "close", "review"]
  },
  "medium": {
    "canMergePrs": false,
    "canCreateReleases": false,
    "canCloseIssues": true,
    "canSelfReview": true,
    "requiresUserApprovalFor": ["merge", "release"]
  },
  "high": {
    "canMergePrs": true,
    "canCreateReleases": true,
    "canCloseIssues": true,
    "canSelfReview": true,
    "requiresUserApprovalFor": []
  }
}
```

## Model Selection

IO includes a model registry with three tiers:

| Tier | Use Case | Examples |
|------|----------|---------|
| Fast | Simple tasks, quick responses | GPT-4.1 Mini, Claude Haiku |
| Standard | General work, code generation | GPT-4.1, Claude Sonnet |
| Reasoning | Complex analysis, architecture | Claude Opus, o3 |

The team lead selects the appropriate model per task based on complexity assessment.

## Instance Limits

Each squad can have at most **3 concurrent instances** to prevent resource exhaustion. This is configurable via `maxInstancesPerSquad` in the config.
