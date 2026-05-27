# Telegram Bot

IO includes a Telegram bot interface powered by [grammy](https://grammy.dev/). This lets you interact with IO from anywhere on your phone.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token
3. Find your Telegram user ID (message [@userinfobot](https://t.me/userinfobot))
4. Run `io setup` or add to `~/.io/config.json`:

```json
{
  "telegramBotToken": "123456:ABC-DEF...",
  "authorizedUserId": 123456789,
  "telegramEnabled": true
}
```

5. Restart IO

## Security

The bot only responds to the configured `authorizedUserId`. All other users receive an "Unauthorized" message and are ignored.

## Features

- **Text messages** — sent directly to the orchestrator
- **Images** — attached to messages for vision-capable model processing
- **Documents** — file attachments forwarded with captions
- **Markdown** — responses are formatted with Telegram-compatible Markdown

## Notifications

When `backgroundNotifyTelegram` is enabled (default), IO will push notifications to your Telegram chat for:
- Completed squad agent tasks
- Feed items (based on `backgroundNotifyMode` setting)

## Message Length

Telegram has a 4096 character limit per message. Responses exceeding this are automatically truncated with a `...(truncated)` indicator.
