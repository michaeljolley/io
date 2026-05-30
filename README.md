<p align="center">
  <img src="assets/IO-logo.svg" alt="IO Logo" width="200" />
</p>

<h1 align="center">IO</h1>

<p align="center">
  <strong>AI Orchestrator Daemon — manage specialized agent squads for your software projects</strong>
</p>

<p align="center">
  <a href="https://michaeljolley.github.io/io">Documentation</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## What is IO?

IO is an always-running daemon that acts as your personal AI orchestrator. You talk to IO, and IO manages teams of specialized AI agents ("squads") that work on your codebases.

- **One conversation interface** — talk to IO via TUI, Telegram, or the web dashboard
- **Squad delegation** — IO automatically routes project questions to the right squad
- **Universe theming** — squads get pop-culture character names and personas via LLM
- **Web dashboard** — React SPA with real-time chat, squad management, and usage charts
- **Cron schedules** — automate recurring tasks like daily standups or issue triage
- **Inbox system** — squads can send you deliverables or ask blocking questions
- **Model management** — token tracking and configurable model selection per agent

## Architecture

```mermaid
graph TD
    User["🧑 You<br/>(TUI / Telegram / Web)"]
    Orch["🤖 Orchestrator<br/>(Copilot SDK · tool-calling)"]
    Wiki["📚 Wiki<br/>(Knowledge Base)"]
    Skills["🧩 Skills<br/>(SKILL.md)"]
    Sched["⏰ Scheduler<br/>(cron jobs)"]
    SquadA["👥 Squad A<br/>(Team Lead + Agents)"]
    SquadB["👥 Squad B<br/>(Team Lead + Agents)"]
    Web["🌐 Web Dashboard<br/>(React SPA)"]

    User --> Orch
    User --> Web
    Web --> Orch
    Orch --> SquadA
    Orch --> SquadB
    Orch --> Sched
    Orch --> Wiki
    Orch --> Skills
    SquadA --> Wiki
    SquadB --> Wiki
```

Each squad has:
- **Team Lead** — receives objectives, creates plans, coordinates agents
- **Agents** — specialized workers (developer, reviewer, etc.) with pop-culture character names
- **Meetings** — structured collaboration between agents for planning and review
- **QA/Tester** — required veto-holding member who must approve before completion

## Getting Started

### Prerequisites

- Node.js 22+
- GitHub Copilot access (the daemon uses `@github/copilot-sdk`)
- Git

### Installation

```bash
git clone https://github.com/michaeljolley/io.git
cd io
npm install
npm run build
```

### Running

```bash
# Start the daemon
npm run dev

# Or build and start
npm run build
npm start
```

The daemon starts on port `7777` by default. The web dashboard is served at the same port — open `http://localhost:7777` in your browser.

### Configuration

Create `~/.io/config.json`:

```json
{
  "apiPort": 7777,
  "defaultModel": "claude-opus-4.6",
  "logLevel": "info",
  "maxInstancesPerSquad": 3,
  "telegram": {
    "botToken": "your-token-from-botfather",
    "allowedChatIds": [12345678]
  },
  "supabase": {
    "projectUrl": "https://your-project.supabase.co",
    "anonKey": "eyJ...",
    "jwtSecret": "your-jwt-secret"
  }
}
```

All settings can also be controlled via environment variables (which take priority):

| Variable | Config Key | Default |
|----------|-----------|---------|
| `IO_PORT` | `apiPort` | `7777` |
| `IO_LOG_LEVEL` | `logLevel` | `info` |
| `IO_MODEL` | `defaultModel` | `claude-opus-4.6` |
| `IO_DATA_DIR` | `dataDir` | `~/.io` |
| `TELEGRAM_BOT_TOKEN` | `telegram.botToken` | — |
| `TELEGRAM_ALLOWED_CHAT_IDS` | `telegram.allowedChatIds` | — |
| `IO_SUPABASE_URL` | `supabase.projectUrl` | — |
| `IO_SUPABASE_ANON_KEY` | `supabase.anonKey` | — |
| `IO_SUPABASE_JWT_SECRET` | `supabase.jwtSecret` | — |

See the [Configuration Guide](https://michaeljolley.github.io/io/guides/configuration/) for full details.

### Authentication

When Supabase is configured, the web dashboard requires login and all API endpoints are secured with JWT verification. If Supabase is **not** configured, the API stays open (suitable for local-only use).

## Key Features

### Squads

Hire a squad for any project:

> "Hire a squad for https://github.com/org/my-app with the Star Wars universe"

IO creates a team with character names from your chosen universe (e.g., "Yoda" as Team Lead, "R2-D2" as DevOps). Each member gets a persona that influences their communication style.

### Web Dashboard

A full React SPA served by the daemon at the API port:
- **Chat** — real-time streaming conversation with IO
- **Squads** — view teams, members, active instances, and activity
- **Feed** — inbox of deliverables and blocking questions
- **Skills** — manage installed SKILL.md capabilities
- **Schedules** — CRUD for cron-based automation
- **Wiki** — knowledge base viewer and editor
- **Usage** — token and cost charts (by squad, model, time)
- **Settings** — configure all daemon options from the UI

### Schedules

Automate recurring work with cron expressions:

> "Create a daily standup for my-app at 9am on weekdays — have them review open issues and report progress"

### Inbox

Squads communicate back via the inbox:
- **Deliverables** — status reports, completed summaries
- **Blocking questions** — the squad pauses and waits for your answer

### Clients

| Client | Description |
|--------|-------------|
| Web Dashboard | React SPA at `http://localhost:7777` |
| TUI | Terminal interface built with Ink |
| Telegram | Bot integration via Grammy |
| REST API | HTTP endpoints at `/api/*` |
| WebSocket | Real-time streaming at `/ws` |

## Project Structure

```
packages/
├── shared/      # Types, constants, shared utilities
├── daemon/      # Core daemon (orchestrator, squads, API, scheduler)
├── web/         # Web dashboard (React + Vite + Tailwind)
├── tui/         # Terminal UI (Ink/React)
└── telegram/    # Telegram bot client
docs/            # Astro Starlight documentation site
.github/
└── workflows/
    ├── ci.yml           # PR validation (lint, build, test)
    ├── release.yml      # Tag-based release + npm publish
    └── deploy-docs.yml  # Docs site deployment
```

## Development

```bash
# Build all packages
npm run build

# Run daemon in dev mode (watches for changes)
npm run dev

# Run web dashboard dev server (with API proxy)
cd packages/web && npm run dev

# Build documentation
cd docs && npm run build
```

## Documentation

Full documentation is available at **[michaeljolley.github.io/io](https://michaeljolley.github.io/io)**.

## License

MIT
