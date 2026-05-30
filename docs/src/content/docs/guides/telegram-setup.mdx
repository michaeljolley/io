---
title: Telegram Setup
description: Connect IO to Telegram
---

## Overview

The IO Telegram bot lets you interact with the orchestrator from your phone or any Telegram client. Messages you send are forwarded to the daemon, and responses stream back with progressive editing.

## Prerequisites

1. IO daemon running and accessible
2. A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

## Create a Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name (e.g., "IO Assistant")
4. Choose a username (e.g., `io_assistant_bot`)
5. Copy the token BotFather gives you

## Configuration

Set the following environment variables before starting the Telegram package:

```bash
# Required
export TELEGRAM_BOT_TOKEN="your-bot-token-here"

# Optional
export IO_API_PORT="7777"                          # Daemon port (default: 7777)
export TELEGRAM_ALLOWED_CHAT_IDS="123456,789012"   # Restrict access (default: allow all)
```

## Finding Your Chat ID

To restrict access, you need your Telegram chat ID:

1. Message your bot
2. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find the `chat.id` field in the response

## Running

```bash
cd packages/telegram
TELEGRAM_BOT_TOKEN=your-token npm start
```

Or in development mode with auto-reload:

```bash
TELEGRAM_BOT_TOKEN=your-token npm run dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and help |
| `/status` | Check daemon health and uptime |
| `/squads` | List all active squads |

## How It Works

1. You send a text message to the bot
2. Bot sends a "💭 Thinking..." placeholder
3. Message is forwarded to the daemon via WebSocket
4. As tokens stream back, the placeholder is edited in-place
5. Final complete message replaces the placeholder

Edits are rate-limited to avoid Telegram API throttling (max 1 edit/second, minimum 20 characters of change).

## Attachments

Photos and documents sent to the bot are noted with their caption and forwarded as context to the orchestrator. Full binary attachment support is planned for a future release.
