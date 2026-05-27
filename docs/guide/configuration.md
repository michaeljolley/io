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
| `port` | `number` | `3170` | Port for the HTTP server (API + web frontend) |
| `supabaseUrl` | `string` | — | Supabase project URL (required for auth) |
| `supabaseAnonKey` | `string` | — | Supabase anon/public API key (required for auth) |
| `authorizedEmail` | `string` | — | Email address allowed to access the web portal |
| `backgroundNotifyMode` | `string` | `"meaningful"` | Background task notification frequency: `"all"`, `"meaningful"`, or `"off"` |
| `backgroundNotifyTelegram` | `boolean` | `true` | Send background task notifications via Telegram |
| `watchdogEnabled` | `boolean` | `true` | Enable the daemon event loop watchdog |

## Model Routing

IO discovers available models from the Copilot SDK at startup using `listModels()`. It automatically selects the most appropriate model for each task based on complexity — no configuration needed.

- **Complex tasks** (architecture, refactoring, debugging) → most capable model
- **Medium tasks** (features, tests, reviews) → balanced model
- **Simple tasks** (formatting, lookups, renames) → cheapest/fastest model

The `defaultModel` setting only controls the main orchestrator session. Squad agents use automatic model selection.

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
  "authorizedEmail": "you@example.com"
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
