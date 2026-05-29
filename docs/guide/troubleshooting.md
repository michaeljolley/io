# Troubleshooting

This guide covers common setup and runtime issues, plus the environment variables that affect local development and deployment.

## Common Setup Issues

### GitHub CLI authentication

- Confirm the CLI is authenticated: `gh auth status`
- Re-authenticate with `gh auth login` if the token is missing or expired
- For repository access, ensure the token includes `repo` scope

### Copilot SDK authentication

- Run `copilot login` and confirm the SDK can authenticate before starting IO
- If the daemon fails to start due to model discovery, verify the Copilot token is valid and not expired

### Database and persistent storage

- IO stores persistent data under `~/.io/`
- If the daemon appears to start from scratch, verify that `~/.io/io.db` and the skill directories are present and writable

## Common Runtime Issues

### Web dashboard does not load

- Confirm the daemon is running: `io --daemon`
- Check that the configured `port` is reachable
- Validate Supabase auth settings in `~/.io/config.json` and restart the daemon after changes

### Telegram integration is unresponsive

- Verify `telegramBotToken` and `authorizedUserId` are present
- Confirm the bot token is valid and the bot has been started from Telegram BotFather

### Skills and registry lookups fail

- Verify outbound network access to the skills registry
- Confirm the daemon can fetch remote skill content and that the `~/.io/skills` directory is writable

## Environment Variables

IO reads runtime settings from `~/.io/config.json` for local execution, but several operational values are commonly set in the shell or service manager:

| Variable | Purpose | Notes |
| --- | --- | --- |
| `GITHUB_TOKEN` | GitHub API access for issue/PR operations and repository-related tooling | Often supplied by `gh` or CI |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token used by the daemon | Matches `telegramBotToken` in config |
| `AUTHORIZED_USER_ID` | Telegram user ID allowed to interact with the bot | Matches `authorizedUserId` in config |
| `SUPABASE_URL` | Supabase project URL for web auth | Matches `supabaseUrl` in config |
| `SUPABASE_ANON_KEY` | Supabase anon key for web auth | Matches `supabaseAnonKey` in config |
| `PORT` | HTTP server port | Matches `port` in config |

## Recovery Steps

1. Stop the running daemon if it is active.
2. Review the latest logs for connection or authentication failures.
3. Verify `~/.io/config.json` and `~/.io/mcp.json` contents.
4. Restart IO and re-test the affected workflow.
