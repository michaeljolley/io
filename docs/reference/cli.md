# CLI Reference

IO provides a command-line interface via the `io` command.

## Commands

### `io start`

Start the IO daemon.

```bash
io start
```

The daemon will:
1. Initialize the data directory at `~/.io/`
2. Start the database and run migrations
3. Load skills and wiki
4. Start the orchestrator
5. Start the scheduler
6. Start the API server on port 7777
7. Connect to Telegram (if configured)

### `io setup`

Interactive first-time setup wizard.

```bash
io setup
```

Prompts for:
- Telegram bot token (optional)
- Supabase credentials (optional)
- Port configuration
- Log level

### `io --version`

Print the current version.

```bash
io --version
```

### `io --help`

Show help information.

```bash
io --help
```

## Global Options

| Option | Description |
|--------|-------------|
| `--version`, `-v` | Print version and exit |
| `--help`, `-h` | Show help and exit |

## Process Management

IO is designed to run as a long-lived daemon. Recommended approaches:

### Using pm2

```bash
npm install -g pm2
pm2 start "io start" --name io
pm2 save
pm2 startup  # auto-start on boot
```

### Using systemd (Linux)

```ini
[Unit]
Description=IO Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/io start
Restart=on-failure
User=your-user
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Using launchd (macOS)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/io</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean shutdown |
| 1 | Startup error (config, database, etc.) |
