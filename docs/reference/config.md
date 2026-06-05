# Configuration Reference

Complete reference for all configuration options in `~/.io/config.json`.

## Full Schema

```json
{
  "port": 7777,
  "logLevel": "info",
  "sessionResetThreshold": 50,
  "telegram": {
    "token": "string",
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
  }
}
```

## Fields

### `port`
- **Type:** `number`
- **Default:** `7777`
- **Env:** `IO_PORT`
- **Description:** HTTP and WebSocket server port

### `logLevel`
- **Type:** `"trace" | "debug" | "info" | "warn" | "error"`
- **Default:** `"info"`
- **Env:** `IO_LOG_LEVEL`
- **Description:** Minimum log level for output

### `sessionResetThreshold`
- **Type:** `number`
- **Default:** `50`
- **Env:** `IO_SESSION_RESET`
- **Description:** Number of messages before rolling window reset

### `telegram`

#### `telegram.token`
- **Type:** `string`
- **Env:** `IO_TELEGRAM_TOKEN`
- **Description:** Bot token from @BotFather

#### `telegram.allowedUsers`
- **Type:** `number[]`
- **Env:** `IO_TELEGRAM_USERS` (comma-separated)
- **Description:** Telegram user IDs allowed to interact with the bot

### `supabase`

#### `supabase.url`
- **Type:** `string`
- **Env:** `IO_SUPABASE_URL`
- **Description:** Supabase project URL for auth

#### `supabase.anonKey`
- **Type:** `string`
- **Env:** `IO_SUPABASE_ANON_KEY`
- **Description:** Supabase anonymous/public key

### `models`

#### `models.fast`
- **Type:** `string`
- **Default:** `"gpt-4.1-mini"`
- **Env:** `IO_MODEL_FAST`
- **Description:** Model used for simple, fast responses

#### `models.standard`
- **Type:** `string`
- **Default:** `"claude-sonnet-4.6"`
- **Env:** `IO_MODEL_STANDARD`
- **Description:** Model used for moderate complexity tasks

#### `models.premium`
- **Type:** `string`
- **Default:** `"claude-sonnet-4.6"`
- **Env:** `IO_MODEL_PREMIUM`
- **Description:** Model used for complex reasoning tasks

## Validation

Configuration is validated at startup using Zod. Invalid config will cause a startup error with a descriptive message indicating which field is invalid.

## Environment Variable Precedence

Environment variables always override `config.json` values. This makes it easy to configure IO differently in production vs development without modifying the config file.
