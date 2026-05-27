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
| `models` | `string[]` | *(see below)* | Available models — IO auto-selects based on task complexity |
| `port` | `number` | `3170` | Port for the HTTP server (API + web frontend) |
| `supabaseUrl` | `string` | — | Supabase project URL (required for auth) |
| `supabaseAnonKey` | `string` | — | Supabase anon/public API key (required for auth) |
| `authorizedEmail` | `string` | — | Email address allowed to access the web portal |
| `backgroundNotifyMode` | `string` | `"meaningful"` | Background task notification frequency: `"all"`, `"meaningful"`, or `"off"` |
| `backgroundNotifyTelegram` | `boolean` | `true` | Send background task notifications via Telegram |
| `watchdogEnabled` | `boolean` | `true` | Enable the daemon event loop watchdog |

## Model Routing

IO has built-in knowledge of model capabilities and automatically selects the most appropriate model for each task's complexity. You just provide the list of models you want IO to use:

```json
{
  "models": ["claude-opus-4.7", "claude-sonnet-4.6", "claude-haiku-4.5", "gpt-5.5", "gpt-5.4-mini"]
}
```

For complex tasks (architecture, refactoring, debugging), IO picks the most capable model. For simple tasks (formatting, lookups), it picks the cheapest. No manual categorization required.

## Example Config

```json
{
  "telegramBotToken": "123456:ABC-DEF...",
  "authorizedUserId": 123456789,
  "telegramEnabled": true,
  "selfEditEnabled": false,
  "defaultModel": "claude-sonnet-4.6",
  "models": ["claude-opus-4.7", "claude-sonnet-4.6", "claude-haiku-4.5", "gpt-5.5", "gpt-5.4-mini"],
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
