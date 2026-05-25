# Telegram Bot

IO includes a Telegram bot interface powered by [grammY](https://grammy.dev/), giving you mobile access to your AI assistant.

## Setup

### 1. Create a Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Choose a display name (e.g., "IO Assistant")
4. Choose a username (must end in `bot`, e.g., `io_assistant_bot`)
5. BotFather will give you a **bot token** — save this

### 2. Get Your Telegram User ID

IO authorizes users by their numeric Telegram user ID, not by username.

To find your user ID, message [@userinfobot](https://t.me/userinfobot) on Telegram — it will reply with your numeric ID (e.g., `123456789`).

### 3. Configure IO

The easiest way to configure Telegram is through the setup wizard:

```bash
io setup
```

The wizard will prompt you for your bot token, user ID, and whether to enable the Telegram interface.

Alternatively, edit `~/.io/config.json` directly:

```json
{
  "telegramBotToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "authorizedUserId": 123456789,
  "telegramEnabled": true
}
```

::: warning
Keep your bot token secret. If compromised, use `/revoke` with BotFather to generate a new one.
:::

### 4. Restart IO

Restart the daemon so it picks up the new configuration. You should see in the logs:

```
[io] Telegram bot polling started
```

## Usage

Send any message to your bot and the orchestrator will handle it. While processing, the bot shows a typing indicator and posts a placeholder message (`…`) that is progressively edited with the streaming response.

### Streaming Responses

As the orchestrator generates a response, the bot edits its placeholder message in real time so you can read the reply as it arrives. Edits are debounced (500 ms) to stay within Telegram's rate limits.

### Long Responses

Telegram has a 4096-character message limit. IO automatically splits long messages into multiple chunks when sending proactive notifications.


## Sending Images & Files

IO's Telegram bot supports photo and document attachments. You can send an image or file alongside your message and IO will pass it to the underlying model.

**How it works:**

1. Send a photo or document to the bot (with or without a caption)
2. IO acknowledges receipt, downloads the file from Telegram's servers, and converts it to base64
3. Images are passed to vision-capable models as blob content blocks
4. Text from any caption is used as the prompt text; if there is no caption, IO processes the attachment alone

**Multiple images:** Each image in a multi-photo message is included as a separate content block in the same prompt.

**File size limit:** Files larger than **5 MB** are rejected with a notification. Telegram normally restricts bot downloads to 20 MB, but IO enforces a lower 5 MB limit to keep context sizes manageable.

**Document types:** Any file Telegram delivers as a `document` (PDFs, logs, code files, etc.) is supported. Binary files that cannot be meaningfully interpreted as text will be passed as-is — the model handles them as best it can.

::: tip
Vision-capable models (e.g. `claude-sonnet-4.6`, `claude-opus-4.7`) can analyze screenshots, design mockups, error screenshots, and diagrams directly — no manual description needed.
:::

## Security

Only the single user ID set in `authorizedUserId` can interact with the bot. Messages from any other user are silently ignored — no error message is sent back, and no processing occurs.

```json
{
  "authorizedUserId": 123456789
}
```

Because authorization is by numeric ID rather than username, it cannot be spoofed by changing a Telegram display name.

## Without Telegram

If `telegramEnabled` is `false` or `telegramBotToken` is not set in `~/.io/config.json`, IO starts normally without the Telegram interface. No errors are produced — Telegram is fully optional.
