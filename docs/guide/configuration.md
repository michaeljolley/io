# Configuration

IO stores its configuration at `~/.io/config.json`. The setup wizard (`io setup`) handles initial configuration, but you can edit the file directly.

## Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `telegramBotToken` | `string` | — | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `authorizedUserId` | `number` | — | Your Telegram user ID (only this user can interact with the bot) |
| `telegramEnabled` | `boolean` | `false` | Enable the Telegram bot interface |
| `selfEditEnabled` | `boolean` | `false` | Allow IO to modify its own source code |
| `defaultModel` | `string` | `"gpt-4.1"` | LLM model for the main orchestrator session |
| `modelTiers` | `object` | *(see below)* | Per-complexity model preferences for squad agents |
| `port` | `number` | `3170` | Port for the HTTP server (API + web frontend) |
| `supabaseUrl` | `string` | — | Supabase project URL (required for auth) |
| `supabaseAnonKey` | `string` | — | Supabase anon/public API key (required for auth) |
| `authorizedEmail` | `string` | — | Email address allowed to access the web portal |
| `backgroundNotifyMode` | `string` | `"meaningful"` | Background task notification frequency: `"all"`, `"meaningful"`, or `"off"` |
| `backgroundNotifyTelegram` | `boolean` | `true` | Send background task notifications via Telegram |
| `watchdogEnabled` | `boolean` | `true` | Enable the daemon event loop watchdog |

## Model Tiers

Model tiers control which LLM is selected for squad agent tasks based on complexity:

```json
{
  "modelTiers": {
    "high": ["claude-opus-4.7", "claude-opus-4.6"],
    "medium": ["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"],
    "low": ["claude-haiku-4.5", "gpt-5.4-mini"]
  }
}
```

Each list is a ranked preference — IO picks the first available model.

## Example Config

```json
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
    "medium": ["claude-sonnet-4.6", "gpt-5.5"],
    "low": ["claude-haiku-4.5", "gpt-5.4-mini"]
  }
}
```

## File Paths

All persistent data is stored under `~/.io/`:

| Path | Purpose |
| --- | --- |
| `~/.io/config.json` | User configuration |
| `~/.io/wiki/` | Knowledge base (Markdown files) |
| `~/.io/io.db` | SQLite database (squads, tasks, feed) |
| `~/.io/skills/` | Installed skills |
| `~/.io/mcp.json` | MCP server configuration |
| `~/.io/sessions/` | Copilot SDK session data |

## Authentication

::: warning
All API endpoints require authentication. There is no unauthenticated access.
:::

IO uses Supabase for authentication. You must configure:
- `supabaseUrl` — your Supabase project URL
- `supabaseAnonKey` — your Supabase anon/public key
- `authorizedEmail` — the email allowed to access the dashboard

The Telegram bot uses `authorizedUserId` to restrict access to a single user.
