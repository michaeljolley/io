# Configuration

IO is configured via `~/.io/config.json` and environment variables. Environment variables take precedence.

## Config File

```json
{
  "port": 7777,
  "logLevel": "info",
  "telegram": {
    "token": "YOUR_BOT_TOKEN",
    "allowedUsers": [123456789]
  },
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key"
  },
  "models": {
    "fast": "gpt-4.1-mini",
    "standard": "claude-sonnet-4.6",
    "premium": "claude-sonnet-4.6"
  },
  "sessionResetThreshold": 50
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IO_PORT` | HTTP/WS server port | `7777` |
| `IO_LOG_LEVEL` | Log level (trace/debug/info/warn/error) | `info` |
| `IO_TELEGRAM_TOKEN` | Telegram bot token | — |
| `IO_TELEGRAM_USERS` | Comma-separated allowed Telegram user IDs | — |
| `IO_SUPABASE_URL` | Supabase project URL | — |
| `IO_SUPABASE_ANON_KEY` | Supabase anonymous key | — |
| `IO_MODEL_FAST` | Fast-tier model | `gpt-4.1-mini` |
| `IO_MODEL_STANDARD` | Standard-tier model | `claude-sonnet-4.6` |
| `IO_MODEL_PREMIUM` | Premium-tier model | `claude-sonnet-4.6` |
| `IO_SESSION_RESET` | Message count before session reset | `50` |

## Model Tiers

IO uses smart model routing to balance cost and capability:

| Tier | Use Case | Default Model |
|------|----------|---------------|
| **Fast** | Simple questions, greetings, status checks | `gpt-4.1-mini` |
| **Standard** | Moderate tasks, code questions, planning | `claude-sonnet-4.6` |
| **Premium** | Complex analysis, architecture decisions | `claude-sonnet-4.6` |

The router classifies each incoming message and selects the appropriate tier automatically. You can override models per tier in config.

## Authentication

### Telegram

Authentication is by Telegram user ID. Add your numeric user ID to `telegram.allowedUsers` in config. Messages from other users are ignored.

### Web Dashboard

If Supabase is configured, the web dashboard requires login. Without Supabase config, the dashboard is open (suitable for local-only use).

## Data Directory

All IO data lives in `~/.io/`:

| Path | Purpose |
|------|---------|
| `config.json` | Configuration |
| `io.db` | libSQL database (squads, conversations, tokens, etc.) |
| `wiki/pages/` | Knowledge base markdown pages |
| `skills/` | Installed SKILL.md skill files |
| `logs/io.log` | Application logs (rotated) |
