<p align="center">
  <img src="assets/IO-logo.svg" alt="IO" width="200" />
</p>

<h1 align="center">IO</h1>

<p align="center">
  A self-hosted AI orchestrator daemon with squad-based team delegation.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/heyio"><img src="https://img.shields.io/npm/v/heyio" alt="npm version" /></a>
  <a href="https://github.com/michaeljolley/io/actions"><img src="https://github.com/michaeljolley/io/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/node/v/heyio" alt="node version" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/michaeljolley/io" alt="license" /></a>
</p>

---

## What is IO?

IO is your personal AI companion — an always-on daemon you communicate with via a **web dashboard** or **Telegram**. It can answer questions directly, manage a personal wiki, schedule recurring tasks, and delegate project-specific work to **squads** of specialized AI agents.

### Key Concepts

- **Io** — The orchestrator. It routes your messages, manages squads, and can do direct coding work on repos without a squad.
- **Squad** — A team of AI agents assigned to a single repository. Each squad has a Team Lead, a QA agent, and LLM-generated specialist roles.
- **Execution Pipeline** — When a squad receives an objective: plan → parallel agents (git worktrees) → review → QA veto → PR creation.

---

## Features

- 🤖 **Smart Model Routing** — Io classifies messages by complexity and routes to fast/standard/premium models automatically
- 👥 **Squad Delegation** — Hire a squad for any repo; Io delegates all project questions to it
- 🔄 **Parallel Execution** — Agents work simultaneously in isolated git worktrees
- ✅ **QA Gate** — Mandatory QA review with veto power (max 3 revision cycles before escalation)
- 📋 **4 PR Modes** — Branch-only, draft PR, ready PR, or auto-merge (configurable per squad)
- 📅 **Cron Scheduler** — Automate recurring tasks (daily standups, issue triage, dependency updates)
- 📬 **Inbox** — Blocking questions and deliverables from squads, reviewed at your pace
- 📝 **Wiki** — Personal knowledge base with search, tags, and episodic memory
- 🔌 **Skills** — Extensible via SKILL.md files (install from GitHub or marketplace)
- 🔧 **MCP Support** — Agents can connect to external MCP servers
- 📊 **Token Tracking** — Per-agent usage granularity with cost breakdowns
- 💬 **Telegram** — Chat with Io and receive notifications on your phone
- 🌐 **Web Dashboard** — Full-featured React app (chat, squads, inbox, wiki, schedules, usage, skills)

---

## Quick Start

### Install

```bash
npm install -g heyio
```

### Setup

```bash
io setup
```

This creates `~/.io/config.json` with your preferences (port, Telegram token, Supabase auth, etc.)

### Run

```bash
io
```

The daemon starts and serves the web dashboard at `http://localhost:7777`.

---

## Requirements

- **Node.js 22+**
- **GitHub Copilot** subscription (for the `@github/copilot-sdk`)
- **Git** and **gh** CLI (for squad PR creation)
- **Telegram Bot Token** (optional, for mobile access)

---

## Configuration

IO stores all data in `~/.io/`:

```
~/.io/
├── config.json       # Main configuration
├── io.db             # SQLite database
├── wiki/pages/       # Wiki markdown pages
├── skills/           # Installed SKILL.md files
├── skills-lock.json  # Skills manifest
└── logs/io.log       # Structured logs
```

### Config Options

| Key | Env Variable | Default | Description |
|-----|-------------|---------|-------------|
| `port` | `IO_PORT` | `7777` | API server port |
| `logLevel` | `IO_LOG_LEVEL` | `info` | Log level (trace/debug/info/warn/error) |
| `defaultModel` | `IO_DEFAULT_MODEL` | `gpt-4.1` | Default LLM model |
| `telegramToken` | `IO_TELEGRAM_TOKEN` | — | Telegram bot token |
| `telegramUserId` | `IO_TELEGRAM_USER_ID` | — | Your Telegram user ID |
| `supabaseUrl` | `IO_SUPABASE_URL` | — | Supabase URL (for dashboard auth) |
| `supabaseAnonKey` | `IO_SUPABASE_ANON_KEY` | — | Supabase anon key |
| `sessionResetThreshold` | `IO_SESSION_RESET_THRESHOLD` | `50` | Messages before session reset |

---

## Squads

### Hiring a Squad

Tell Io to hire a squad for a repository:

> "Hire a squad for https://github.com/myorg/my-app"

Io analyzes the repo, proposes a team composition (Team Lead + QA + specialists), and asks for your approval.

### Squad Composition

| Role | Mandatory | Purpose |
|------|-----------|---------|
| Team Lead | ✅ | Plans objectives, assigns tasks, picks models |
| QA | ✅ | Reviews diffs, runs tests, approves/rejects |
| *Generated* | ❌ | Specialists based on repo (e.g., "API Developer", "UI Specialist") |

### PR Modes

Configure per squad how completed work is delivered:

| Mode | Behavior |
|------|----------|
| `branch-only` | Branch pushed; PR only if QA approves |
| `draft-pr` | Draft PR created; promoted to ready on QA approval |
| `ready-pr` | PR created as ready; stays open if QA rejects |
| `auto-merge` | PR created; auto-merged on QA approval |

---

## Execution Pipeline

```
Objective received
  → Team Lead creates plan
    → Tasks assigned to agents
      → Agents execute in parallel (git worktrees)
        → Review meeting
          → QA gate
            ├─ Approved → Push branch + create PR (per prMode)
            ├─ Rejected (< 3x) → Agents revise with feedback
            └─ Rejected (3x) → Escalate to inbox
```

---

## Development

### Prerequisites

```bash
node --version  # >= 22.0.0
git --version
gh --version
```

### Setup

```bash
git clone https://github.com/michaeljolley/io.git
cd io
npm install
```

### Build

```bash
npm run build          # Build all packages
npm run build:shared   # Build shared types
npm run build:daemon   # Build daemon with esbuild
npm run build:web      # Build web dashboard with Vite
```

### Dev Mode

```bash
npm run dev            # Run daemon with tsx --watch
```

### Test

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

### Lint

```bash
npm run lint           # Check with Biome
npm run lint:fix       # Auto-fix
npm run format         # Format with Biome
```

---

## Project Structure

```
packages/
├── shared/           # Types, constants, config schema
├── daemon/           # Core daemon (orchestrator, squads, execution, API)
│   └── src/
│       ├── orchestrator/   # Io brain + tools
│       ├── squad/          # Squad hiring + management
│       ├── execution/      # Full pipeline (plan, tasks, agents, QA, PR)
│       ├── copilot/        # Copilot SDK integration + model routing
│       ├── store/          # libSQL database layer
│       ├── api/            # Express REST + WebSocket
│       ├── wiki/           # Personal knowledge base
│       ├── skills/         # SKILL.md extensibility
│       ├── scheduler/      # Cron automation
│       └── telegram/       # Grammy bot + notifications
└── web/              # React dashboard (Vite + Tailwind + Radix UI)
```

---

## API

The daemon exposes a REST API + WebSocket at the configured port (default 7777).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message to Io |
| GET | `/api/conversations` | List conversations |
| GET | `/api/squads` | List squads |
| POST | `/api/squads` | Create squad |
| POST | `/api/squads/:id/objectives` | Assign objective |
| GET | `/api/inbox` | List inbox items |
| POST | `/api/inbox/:id/reply` | Reply to inbox item |
| GET | `/api/schedules` | List schedules |
| POST | `/api/schedules` | Create schedule |
| GET | `/api/wiki/pages` | List wiki pages |
| GET | `/api/wiki/search` | Search wiki |
| GET | `/api/skills` | List installed skills |
| GET | `/api/usage` | Token usage summary |
| GET | `/api/activity` | Activity feed |

### WebSocket

Connect to `ws://localhost:7777` and subscribe to channels for real-time events:

```json
{ "type": "subscribe", "channels": ["chat", "inbox", "activity"] }
```

---

## License

[MIT](LICENSE)
