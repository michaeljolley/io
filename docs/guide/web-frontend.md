# Web Frontend

IO includes a Vue 3 web dashboard served directly from the daemon. It provides a browser-based interface for interacting with IO alongside the TUI and Telegram interfaces.

## Accessing the Dashboard

The web frontend is available at:

```
http://your-server:PORT/
```

By default, IO runs on port `3170`, so the dashboard is at `http://localhost:3170/`. You can change the port via the `port` field in `~/.io/config.json`.

## Available Views

The dashboard includes the following views:

- **Chat** — Real-time conversation with IO via Server-Sent Events (SSE) streaming
- **Squads** — View and manage project squads. Each squad displays its 80s universe badge and a full **agent roster** showing character names, role titles, and status.
- **Skills** — Browse and manage installed skills
- **Feed** — Notification feed from squad activity and system events
- **Inbox** — Personal inbox for direct messages and deliverables from squads
- **MCP** — Manage MCP server connections: add/remove servers, enable/disable, and reload tools
- **Agent Activity** — Monitor background agent tasks and their status. Shows the **character name** and role for each active agent. Click any active agent to open **Preview** mode and stream their live activity in real time.

## Port Configuration

Set the `port` field in your config to change the listening port:

```jsonc
{
  "port": 3170
}
```

All interfaces (Web UI, API, and SSE) share this port.

## Authentication (Optional)

By default, the web portal runs open — no login required. You can optionally secure it with [Supabase](https://supabase.com/) authentication.

### Setup

1. Create a Supabase project at [supabase.com](https://supabase.com/)
2. Enable the **Email** auth provider in Authentication → Providers
3. Create a user account in the Supabase dashboard
4. Add the following fields to `~/.io/config.json`:

```jsonc
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIs...",
  "authorizedEmail": "you@example.com"
}
```

5. Restart IO

### How It Works

- When all three fields (`supabaseUrl`, `supabaseAnonKey`, `authorizedEmail`) are configured, the portal requires login
- Only the configured `authorizedEmail` can access the dashboard
- Without these fields, the portal remains open to anyone who can reach the server

::: tip
Authentication is entirely optional. If you're running IO on a trusted network or behind a VPN, you may not need it.
:::
