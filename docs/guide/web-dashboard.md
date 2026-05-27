# Web Dashboard

IO includes a Vue 3 web dashboard served from the daemon on port 3170 (configurable).

## Access

Once IO is running in daemon mode, open:

```
http://localhost:3170
```

## Authentication

The dashboard requires Supabase email/password authentication. Configure your Supabase credentials in `~/.io/config.json` (see [Configuration](/guide/configuration)).

Only the `authorizedEmail` address is allowed to sign in.

## Pages

### Chat
The primary interface — a real-time conversation with the IO orchestrator. Messages stream in token-by-token via Server-Sent Events.

### Squads
Overview of all project squads. Click a squad card to see its agent roster, active instances, and recent tasks.

### Squad Health
At-a-glance dashboard of health metrics for every squad. Cards are sorted by urgency (stalled first, then active, then idle) and show:
- **Completed tasks** — all-time and last 7 days
- **Average cycle time** — mean time from task creation to completion
- **Task status badges** — in-progress, pending, and failed counts
- **Active instances** — git worktree branches currently in use
- **Recent activity** — last 5 task updates with status icons
- **Stalled indicator** — highlighted when a squad has active tasks with no updates in over 60 minutes

### Feed
Unified inbox for all deliverables from squads and the orchestrator. Items can be filtered by read/unread status and source.

### Skills
Browse installed skills. Skills are managed via the CLI (`io skill add/remove`).

### MCP Servers
Manage external MCP tool servers. Add, remove, and enable/disable servers and individual tools.

### Schedules
Configure cron-based recurring tasks. Two tabs:
- **Squad Schedules** — recurring stand-ups delivered to squad leads
- **IO Schedules** — prompts delivered directly to the orchestrator

### Wiki
Browse and edit the `~/.io/wiki/` knowledge base. File tree on the left, content on the right with edit/delete capabilities.

### Settings
Configure IO parameters grouped by category: General, Telegram, Auth, Models, and Advanced.

## Tech Stack

- **Vue 3** with Composition API
- **Pinia** for state management
- **Vue Router** with auth guards
- **Tailwind CSS** with shadcn/ui design tokens
- **Lucide** icons
- **Vite** for development and production builds
