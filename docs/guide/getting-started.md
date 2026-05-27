# Getting Started

## Prerequisites

- **Node.js** >= 22
- **GitHub Copilot subscription** — IO uses the Copilot SDK, which requires an active Copilot license
- **GitHub CLI** (`gh`) — required for the GitHub tool. Install from [cli.github.com](https://cli.github.com/) and authenticate with `gh auth login`

## Install

```bash
npm install -g heyio
```

## Setup

Run the setup wizard to configure authentication and integrations:

```bash
io setup
```

This will prompt you for:
- **Supabase credentials** (required for web/API authentication)
- **Telegram bot token** (optional, for Telegram interface)

Configuration is saved to `~/.io/config.json`.

## Run

```bash
# Start the daemon (Telegram + HTTP API + Web Dashboard)
io --daemon

# Start with self-edit permission (allows IO to modify its own source)
io --daemon --self-edit
```

## Access the Web Dashboard

Once running, open `http://localhost:3170` in your browser. Sign in with the email configured in your Supabase auth.

## Headless Server (systemd)

To run IO as a background service:

1. Authenticate: `copilot login` and `gh auth login`
2. Create a service file at `/etc/systemd/system/io.service`:

```ini
[Unit]
Description=IO Personal Assistant
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env io --daemon
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. Enable and start: `systemctl enable --now io`
