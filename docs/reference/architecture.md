# Architecture

IO is built as a TypeScript ESM monorepo with three packages, published as a single npm package (`heyio`).

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Web Dashboard                         │
│  React 18 + Vite + Tailwind 4 + Radix UI + Recharts    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────────────┐
│                     IO Daemon                            │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │  Io (Orchestrator)                           │       │
│  │  • Persistent Copilot SDK session            │       │
│  │  • Smart model routing                       │       │
│  │  • Full tool set + squad delegation          │       │
│  │  • Rolling window reset + wiki episodes      │       │
│  └──────────┬───────────────────────────────────┘       │
│             │                                            │
│  ┌──────────▼───────────────────────────────────┐       │
│  │  Squad System (1 squad per repo)             │       │
│  │  Team Lead → Tasks → Agents → QA → PR       │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐         │
│  │  Store  │ │ Wiki │ │ Skills │ │Scheduler │         │
│  │(libSQL) │ │(~/io)│ │(SKILL) │ │ (cron)   │         │
│  └─────────┘ └──────┘ └────────┘ └──────────┘         │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐          │
│  │Event Bus │ │ Telegram │ │ Notifications  │          │
│  └──────────┘ └──────────┘ └────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Package Structure

```
packages/
├── shared/    — Types, constants (imported by daemon + web)
├── daemon/    — Core daemon: orchestrator, squads, API, store
└── web/       — React SPA dashboard
```

### Shared (`packages/shared/`)

Exports TypeScript types and constants used by both daemon and web:
- Squad, conversation, store, API, and event types
- Application constants (ports, models, paths, event names)

### Daemon (`packages/daemon/`)

The heart of IO. Key subsystems:

| Subsystem | Purpose |
|-----------|---------|
| `copilot/` | Copilot SDK integration, session management, model routing |
| `orchestrator/` | Io's brain — system prompt, tools, message processing |
| `squad/` | Squad lifecycle, hiring, model selection |
| `execution/` | Full pipeline: plan → tasks → agents → review → QA → PR |
| `store/` | libSQL database, all CRUD operations |
| `wiki/` | Markdown knowledge base |
| `skills/` | SKILL.md loader and manager |
| `scheduler/` | Cron engine |
| `api/` | Express server, REST routes, WebSocket |
| `telegram/` | Grammy bot |
| `logging/` | Pino logger factory |

### Web (`packages/web/`)

React SPA served by the daemon's Express server:
- Chat, Squads, Feed (inbox), Wiki, Skills, Schedules, Usage, Settings views
- Real-time updates via WebSocket
- Optional Supabase authentication

## Data Flow

```
User Message → API/Telegram/WS
  → Orchestrator (model routing → system prompt → Copilot SDK)
    → Direct response OR delegate to squad
      → Squad: Team Lead plans → agents execute → QA gate → PR
        → Event bus → WebSocket/Telegram notification
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| LLM | `@github/copilot-sdk` | Single provider, handles auth and streaming |
| Database | libSQL | Async-friendly, Turso-compatible, embedded |
| HTTP | Express 5 | Mature, middleware ecosystem |
| WebSocket | ws | Lightweight, native Node.js |
| Logging | Pino | Fast structured logging, child loggers |
| Telegram | grammY | Modern, TypeScript-first bot framework |
| Build | esbuild | Fast bundling to single ESM output |
| Web | Vite + React | Fast dev server, optimized production build |
| Test | Vitest | Fast, TypeScript-native, compatible API |
| Lint | Biome | All-in-one formatter + linter |

## Data Storage

All data lives in `~/.io/`:

| Path | Format | Purpose |
|------|--------|---------|
| `io.db` | SQLite (libSQL) | Squads, conversations, tokens, schedules, inbox |
| `wiki/pages/` | Markdown + YAML | Knowledge base |
| `skills/` | SKILL.md | Installed capabilities |
| `config.json` | JSON | Configuration |
| `logs/io.log` | JSON (Pino) | Structured logs |
