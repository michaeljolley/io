# Configuration

IO is configured via a JSON file at `~/.io/config.json`. All fields are optional — IO uses sensible defaults when values are omitted.

## Config File Location

`~/.io/config.json` — created automatically by `io setup`, or you can create it manually.

## Reference

```jsonc
{
  "telegramBotToken": "123456:ABC-DEF...",
  "authorizedUserId": 123456789,
  "telegramEnabled": true,
  "selfEditEnabled": false,
  "defaultModel": "claude-sonnet-4.6",
  "port": 3170,
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIs...",
  "authorizedEmail": "you@example.com",
  "modelTiers": {
    "high": ["claude-opus-4.7", "claude-opus-4.6"],
    "medium": ["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"],
    "low": ["claude-haiku-4.5", "gpt-5.4-mini"]
  }
}
```

| Field              | Type      | Default | Description                                                        |
| ------------------ | --------- | ------- | ------------------------------------------------------------------ |
| `telegramBotToken` | `string`  | —       | Bot token from [@BotFather](https://t.me/botfather)                |
| `authorizedUserId` | `number`  | —       | Telegram user ID authorized to interact with the bot               |
| `telegramEnabled`  | `boolean` | `false` | Enable the Telegram bot interface                                  |
| `selfEditEnabled`  | `boolean` | `false` | Allow IO to modify its own configuration and skills at runtime     |
| `defaultModel`     | `string`  | —       | Override the default model (e.g. `"claude-sonnet-4.6"`)            |
| `port`             | `number`  | `3170`  | Port for the web UI and API server                                 |
| `supabaseUrl`      | `string`  | —       | Supabase project URL for web portal authentication                 |
| `supabaseAnonKey`  | `string`  | —       | Supabase anonymous/public key                                      |
| `authorizedEmail`  | `string`  | —       | Email address authorized to access the web portal                  |
| `modelTiers`       | `object`  | —       | Model routing preferences with `high`, `medium`, `low` arrays      |
| `backgroundNotifyMode` | `"all" \| "meaningful" \| "off"` | `"meaningful"` | Controls how often background task results are pushed as notifications |
| `backgroundNotifyTelegram` | `boolean` | `true` | Send background task notifications via Telegram |
| `backgroundNotifyTui` | `boolean` | `true` | Show background task notifications in TUI |
| `watchdogEnabled` | `boolean` | `true` | Enable the daemon event loop watchdog (detects stalls) |

::: warning
Always keep your bot token secret. Never commit `config.json` to version control.
:::


## MCP Configuration

IO supports [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers, which expose additional tools to the orchestrator. MCP servers are configured in a separate file at `~/.io/mcp.json`.

```jsonc
{
  "servers": [
    {
      "name": "figma",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-figma"],
      "env": { "FIGMA_TOKEN": "..." },
      "enabled": true
    },
    {
      "name": "postgres",
      "url": "http://localhost:3001/sse",
      "enabled": true
    }
  ]
}
```

Each server entry supports:
- **`name`** — unique identifier used to namespace the server's tools (e.g., `mcp_figma_*`)
- **`command` + `args`** — stdio transport (runs a local process)
- **`url`** — SSE transport (connects to a running HTTP server)
- **`env`** — environment variables passed to the subprocess (stdio only)
- **`enabled`** — set to `false` to disable without removing

You can also manage MCP servers visually at the **`/mcp`** route in the web UI, or via the `mcp_server_*` tools. See the [MCP guide](/guide/mcp) for full details.

## Model Selection

The Copilot SDK handles model selection automatically — the orchestrator chooses the best model for each operation. You can override the default with the `defaultModel` field, but in most cases no manual model configuration is needed.

## Model Tiers

IO supports smart model routing through the `modelTiers` configuration. This lets you define preference lists for different quality tiers — `high`, `medium`, and `low`. The orchestrator selects the appropriate tier based on the complexity of the task and uses the first available model from the preference list.

```jsonc
{
  "modelTiers": {
    "high": ["claude-opus-4.7", "claude-opus-4.6"],
    "medium": ["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"],
    "low": ["claude-haiku-4.5", "gpt-5.4-mini"]
  }
}
```

Each tier is an array of model names in order of preference. If the first model is unavailable, IO falls back to the next one in the list.

## Authentication

IO's web portal can optionally be secured with [Supabase](https://supabase.com/) authentication. Without auth configured, the portal runs open — accessible to anyone who can reach the server.

To enable authentication:

1. Create a Supabase project at [supabase.com](https://supabase.com/)
2. Enable the **Email** auth provider in Authentication → Providers
3. Create a user account in the Supabase dashboard
4. Add the following to your `config.json`:

```jsonc
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIs...",
  "authorizedEmail": "you@example.com"
}
```

5. Restart IO

Only the configured `authorizedEmail` can access the web portal when authentication is enabled.

## Database Schema Notes

The SQLite database (`~/.io/io.db`) includes a `squads` table with a `universe` column. When a squad is created, it is automatically assigned one of six 80s pop culture universes (A-Team, Transformers, ThunderCats, GI Joe, Aliens, Ghostbusters) unless one is explicitly chosen. No additional configuration fields are required — universe assignment is handled automatically by the `squad_create` tool.

A separate `squad_agents` table tracks the named specialist agents within each squad, including their character name, role title, charter, and model tier.

## Data Directory

IO stores all persistent data in `~/.io/`:

```
~/.io/
├── config.json          # Configuration
├── io.db                # SQLite database (squads, decisions, agents, state)
├── mcp.json             # MCP server configuration
├── wiki/                # Knowledge wiki (markdown files)
└── skills/              # Installed skills (SKILL.md files)
```

## Environment Variables

| Variable   | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `IO_HOME`  | Override the data directory (default: `~/.io/`)              |
| `NODE_ENV` | Standard Node.js environment (`development`, `production`)   |
