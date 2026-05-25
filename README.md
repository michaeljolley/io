# 🤖 IO

A personal AI assistant daemon built on the GitHub Copilot SDK. IO runs 24/7 on your machine, reachable via Telegram, a web UI, and a terminal TUI.

[![CI](https://github.com/michaeljolley/io/actions/workflows/ci.yml/badge.svg)](https://github.com/michaeljolley/io/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)

## ✨ Features

- **Copilot SDK Integration** — powered by GitHub's Copilot SDK for LLM conversations with tool calling
- **Multi-Interface** — Web UI + Telegram bot + terminal TUI + HTTP API
- **Web Frontend** — Vue 3 dashboard with chat, squad management, skills, and agent activity views
- **Persistent Memory** — wiki-based knowledge base stored at `~/.io/wiki/`
- **Squad System** — persistent project teams with **named specialist agents** themed from 80s pop culture (A-Team, Transformers, ThunderCats, GI Joe, Aliens, Ghostbusters)
- **Skills** — modular skill system; install from git repos or the [skills.sh](https://skills.sh) registry
- **Adaptive Sessions** — infinite sessions with automatic context compaction
- **Named Agent Personas** — each squad agent gets a character persona with personality, dynamic role title, and specialized charter
- **GitHub Integration** — create, list, view, and comment on issues and PRs via the `github` tool
- **Smart Model Routing** — automatically selects the best model for each task based on complexity
- **Self-Updating** — checks for updates and can apply them automatically
- **MCP Integration** — Connect to external MCP servers for additional tools (Figma, databases, APIs)
- **Scheduling** — Cron-based scheduling for recurring tasks and squad stand-ups
- **Squad Instances** — Parallel worktrees for concurrent work within a single squad
- **Unified Feed** — Consolidated inbox and notification feed with web UI
- **Telegram Attachments** — Send images/files via Telegram for vision-capable model processing
- **Agent Preview** — Live streaming preview of any squad agent's activity in the web UI
- **Squad Wiki** — Per-squad wiki context included in agent prompts and instance snapshots
- **Instance Watchdog** — Monitors active/merging instances and auto-aborts stale ones

## 📋 Prerequisites

- **Node.js** >= 22
- **GitHub Copilot subscription** — IO uses the Copilot SDK, which requires an active Copilot license
- **GitHub CLI** (`gh`) — required for the `github` tool (issue/PR management). Install from [cli.github.com](https://cli.github.com/) and authenticate with `gh auth login`

## 🚀 Quick Start

### Install

```bash
npm install -g heyio
```

### Setup

Run the setup wizard to configure your Telegram bot token and user ID:

```bash
io setup
```

This creates a config file at `~/.io/config.json`.

### Run

```bash
# Interactive TUI mode
io

# Background daemon (Telegram + HTTP API)
io --daemon

# Allow IO to modify its own source code
io --self-edit
```

### Headless Server (systemd)

To run IO as a background service on a headless server:

1. Authenticate the Copilot SDK: `copilot login`
2. Authenticate the GitHub CLI: `gh auth login`
3. Create a systemd service file at `/etc/systemd/system/io.service`:

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

4. Enable and start: `systemctl enable --now io`

## 💬 CLI Usage

| Command | Description |
| --- | --- |
| `io` | Start interactive TUI mode |
| `io --daemon` | Run as background daemon (Telegram + API) |
| `io --self-edit` | Allow IO to modify its own source |
| `io setup` | Configure Telegram bot token and user ID |
| `io skill list` | List installed skills |
| `io skill add <repo-url>` | Install a skill from a git repository |
| `io skill remove <slug>` | Remove an installed skill |
| `io skill search <query>` | Search the skills.sh registry |

## ⚙️ Configuration

IO stores its configuration at `~/.io/config.json`. The setup wizard (`io setup`) handles initial configuration, but you can also edit the file directly.

### Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `telegramBotToken` | `string` | — | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `authorizedUserId` | `number` | — | Your Telegram user ID (only this user can interact with the bot) |
| `telegramEnabled` | `boolean` | `false` | Enable the Telegram bot interface |
| `selfEditEnabled` | `boolean` | `false` | Allow IO to modify its own source code |
| `defaultModel` | `string` | `"gpt-4.1"` | LLM model for the main orchestrator session |
| `modelTiers` | `object` | *(see below)* | Per-complexity model preferences for squad agents |
| `modelTiers.high` | `string[]` | `["claude-opus-4.7", "claude-opus-4.6"]` | Models for complex tasks (architecture, debugging, design) |
| `modelTiers.medium` | `string[]` | `["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"]` | Models for standard tasks (features, tests, reviews) |
| `modelTiers.low` | `string[]` | `["claude-haiku-4.5", "gpt-5.4-mini"]` | Models for simple tasks (reads, formatting, lookups) |
| `port` | `number` | `3170` | Port for the HTTP server (API + web frontend) |
| `supabaseUrl` | `string` | — | Supabase project URL (enables web portal authentication) |
| `supabaseAnonKey` | `string` | — | Supabase anon/public API key |
| `authorizedEmail` | `string` | — | Email address allowed to access the web portal |
| `backgroundNotifyMode` | `string` | `"meaningful"` | Background task notification frequency: `"all"`, `"meaningful"`, or `"off"` |
| `backgroundNotifyTelegram` | `boolean` | `true` | Send background task notifications via Telegram |
| `backgroundNotifyTui` | `boolean` | `true` | Show background task notifications in TUI |
| `watchdogEnabled` | `boolean` | `true` | Enable the daemon event loop watchdog |

Each `modelTiers` list is a ranked preference — IO picks the first available model at startup.

> **Migration note:** If your config uses the old `apiPort` field, IO will automatically migrate it to `port`.

### Example

```jsonc
{
  "telegramBotToken": "123456:ABC-DEF...",
  "authorizedUserId": 123456789,
  "telegramEnabled": true,
  "selfEditEnabled": false,
  "defaultModel": "claude-sonnet-4.6",
  "port": 3170,
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIs...",
  "authorizedEmail": "you@example.com",
  "modelTiers": {
    "high": ["claude-opus-4.7", "claude-opus-4.6"],
    "medium": ["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"],
    "low": ["claude-haiku-4.5", "gpt-5.4-mini"]
  }
}
```

All persistent data is stored under `~/.io/`:

| Path | Purpose |
| --- | --- |
| `~/.io/config.json` | User configuration |
| `~/.io/wiki/` | Knowledge base (markdown files) |
| `~/.io/io.db` | SQLite database (squads, tasks) |
| `~/.io/skills/` | Installed skills |
| `~/.io/mcp.json` | MCP server configuration |

## 🧩 Skills System

Skills are modular extensions that add new tools and capabilities to IO. Each skill is a directory containing a `SKILL.md` manifest and tool definitions.

### Managing Skills

```bash
# Search the skills.sh registry
io skill search "github"

# Install from a git repo
io skill add https://github.com/user/my-skill.git

# List installed skills
io skill list

# Remove a skill
io skill remove my-skill
```

### Creating a Skill

A skill is a directory with a `SKILL.md` file that describes the skill and its tools. See the [Contributing Guide](CONTRIBUTING.md) for details on the skill format.

## 👥 Squad System

Squads are persistent project teams with **named specialist agents**. Each squad:

- Has an 80s pop culture **universe theme** (A-Team, Transformers, ThunderCats, GI Joe, Aliens, Ghostbusters)
- Contains dynamically-created **specialist agents** with roles tailored to the project (e.g., "Express API Engineer", "Vue.js Frontend Dev")
- Each agent is assigned a **character persona** with personality traits that color their work style
- Remembers decisions, context, and conversation history across sessions
- Persists across sessions in the SQLite database

### How Squads Work

1. **Create** — `squad_create` assigns a random 80s universe (or user picks one)
2. **Analyze** — `squad_analyze` scans the project to determine languages, frameworks, and tools
3. **Build the team** — `squad_add_agent` for each specialist the project needs; characters are drawn from the universe pool
4. **Delegate** — `squad_delegate` sends tasks to specific agents by character name
5. **Track** — `squad_task_status` monitors progress and retrieves results

## 🏗️ Architecture

```
User → [Web UI / TUI / Telegram / HTTP API]
                ↓
         Orchestrator (Copilot SDK)
          ↕           ↕          ↕
     Squad Manager   Wiki/Memory  MCP Servers
          ↓
     Named Agents (80s Characters)
```

IO is built around the **Copilot SDK** which handles all LLM interactions, including tool calling and context management. The **Orchestrator** manages the primary conversation session with automatic context compaction for infinite-length sessions.

For complex tasks, the orchestrator delegates work to **Named Agents** — persistent agent sessions with character personas, specialized roles, and per-agent system prompts. Each agent works autonomously within their squad's project context.

The **Squad System** provides persistent project context, while the **Wiki** serves as a long-term knowledge base that spans all conversations.

### Web Frontend

IO includes a Vue 3 web dashboard served directly from the daemon on the same port as the API (default: 3170). The frontend provides:

- **Chat** — real-time conversation with SSE streaming
- **Squads** — view and manage project squads
- **Skills** — browse installed skills
- **Agent Activity** — monitor running worker agents

Access the web UI at `http://your-server:3170/` when running in daemon mode.

### Authentication

The web portal supports optional Supabase email authentication. When enabled, users must sign in with email and password before accessing the dashboard. Only the configured `authorizedEmail` is allowed access.

**Setup:**

1. Create a [Supabase](https://supabase.com) project (or use an existing one)
2. Enable the **Email** auth provider in Supabase → Authentication → Providers
3. Create your user account in Supabase → Authentication → Users
4. Add the following to `~/.io/config.json`:

```jsonc
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIs...",
  "authorizedEmail": "you@example.com"
}
```

5. Restart IO — the web portal will now require login

> **Note:** Auth is completely optional. If `supabaseUrl` is not configured, the portal runs without authentication (open access).

## 🏗️ Project Structure

```
src/
├── index.ts              # CLI entry (commander)
├── daemon.ts             # Daemon startup/shutdown
├── config.ts             # Config loading
├── paths.ts              # Path constants
├── update.ts             # Self-update checker
├── copilot/
│   ├── client.ts         # CopilotClient singleton
│   ├── orchestrator.ts   # Main session management
│   ├── agents.ts         # Named agent sessions & personas
│   ├── universes.ts      # 80s universe character data
│   ├── tools.ts          # Tool definitions
│   ├── model-router.ts   # Complexity-based model selection
│   ├── skills.ts         # Skills loader
│   └── system-message.ts # System prompt builder
├── store/
│   ├── db.ts             # SQLite database
│   ├── squads.ts         # Squad & agent CRUD
│   └── tasks.ts          # Agent task tracking
├── wiki/
│   ├── fs.ts             # Wiki filesystem
│   └── search.ts         # Wiki search
├── telegram/
│   ├── bot.ts            # Grammy Telegram bot
│   └── handlers.ts       # Command handlers
├── tui/
│   └── index.ts          # Terminal UI
└── api/
    ├── auth.ts           # Supabase JWT auth middleware
    └── server.ts         # Express HTTP + SSE + static frontend

web/                        # Vue 3 frontend (built to web-dist/)
├── src/
│   ├── lib/              # supabase.ts, api.ts (auth helpers)
│   ├── stores/           # Pinia stores (chat, auth)
│   ├── views/            # ChatView, SquadsView, SkillsView, AgentActivityView, LoginView
│   ├── router/           # Vue Router config + auth guard
│   └── main.ts           # App entry
├── vite.config.ts        # Vite config (builds to ../web-dist/)
└── package.json
```

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/michaeljolley/io.git
cd io

# Install dependencies
npm install

# Run in development mode (watch)
npm run dev

# Build for production
npm run build

# Run the TUI directly
npm run tui

# Run the daemon directly
npm run daemon

# Run the test suite
npm test
```

Tests use the Node.js built-in test runner with [tsx](https://github.com/privatenumber/tsx) for TypeScript support. Test files live alongside source files as `*.test.ts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.
