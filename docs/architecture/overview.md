# Architecture Overview

IO is a Node.js daemon that routes user messages through an orchestrator powered by the GitHub Copilot SDK, handling requests directly or delegating to specialized agent squads.

## Technology Stack

- **Runtime**: Node.js 22+ with TypeScript (ESM)
- **AI Engine**: GitHub Copilot SDK (`@github/copilot-sdk`)
- **Database**: SQLite via `better-sqlite3`
- **Telegram**: grammy
- **CLI**: Commander.js
- **TUI**: Node.js readline
- **Web UI**: Vue 3
- **Web API**: Express with Server-Sent Events (SSE)

## High-Level Architecture

```
┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐
│  Telegram    │  │     TUI      │  │  Web UI    │  │  Web API   │
│  (grammy)   │  │  (readline)  │  │  (Vue 3)   │  │ (Express)  │
└──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └─────┬──────┘
       │                │                │                │
       └────────────────┼────────────────┼────────────────┘
                        │
              ┌─────────▼──────────┐
              │    Orchestrator    │
              │  (CopilotSession)  │
              └─────────┬──────────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
   ┌──────▼──────┐ ┌───▼───┐  ┌──────▼──────┐
   │   Squad     │ │ Wiki  │  │   Skills    │
   │   Agents    │ │       │  │   Loader    │
   └──────┬──────┘ └───┬───┘  └─────────────┘
          │            │
   ┌──────▼────────────▼──────┐
   │        SQLite DB         │
   │  (squads, decisions,     │
   │   state, wiki index)     │
   └──────────────────────────┘
```

## Key Components

### CopilotClient

Singleton in `src/copilot/client.ts`. Created with `autoStart` and `autoRestart` enabled. Exposes `getClient()`, `resetClient()`, and `stopClient()`. The orchestrator validates the configured model against `client.listModels()` at startup and runs a periodic health-check that reconnects automatically if the client disconnects.

### Orchestrator

The central routing brain (`src/copilot/orchestrator.ts`). It owns a single `CopilotSession` with streaming enabled and `infiniteSessions` for automatic context compaction. Every user message — regardless of origin — enters through `sendToOrchestrator()`, which enqueues it into a serial processing queue. The orchestrator decides whether to respond directly or delegate work to a squad agent. Failed requests are retried up to three times with automatic session/client recovery.

See [Orchestrator](/architecture/orchestrator) for details.

### Squad Agents

Worker sessions managed by `src/copilot/agents.ts`. Each squad maps to a project directory and is themed with an **80s pop culture universe** (A-Team, Transformers, ThunderCats, GI Joe, Aliens, or Ghostbusters). Squads contain **named specialist agents** — each agent is assigned a character from the squad's universe and given a dynamic role based on the project's needs.

**Key concepts:**

- **Universes** (`src/copilot/universes.ts`) — Six universes with 6–8 characters each, including personality descriptions that flavor the agent's communication style.
- **Dynamic roles** — Roles are not fixed templates. IO analyzes the project (via `squad_analyze`) and creates specialists tailored to the tech stack (e.g., "Frontend Architect", "CI/CD Engineer", "Test Lead").
- **Per-agent sessions** — Each named agent gets its own `CopilotSession` with a personalized system prompt incorporating their character personality, role title, and charter.
- **Character assignment** — Characters are drawn from the universe pool in order (e.g., Hannibal → Face → B.A. → Murdock for A-Team squads).

Agents are created or resumed on demand via `delegateToAgent()`, which runs tasks in the background and reports results through a callback. Each agent session has `shell`, `file_ops`, and `squad_log_decision` tools. The `squad_delegate` tool can target a specific agent by character name.

See [Squads](/architecture/squads) for details.

### Wiki

Markdown-based knowledge store in `src/wiki/`. `fs.ts` handles reading, writing, and structure of wiki pages under `~/.io/wiki/pages/`. `search.ts` provides full-text search across all pages. The orchestrator exposes wiki access through `wiki_read`, `wiki_write`, and `wiki_search` tools.

### Skills Loader

`src/copilot/skills.ts` scans `~/.io/skills/` for subdirectories containing a `SKILL.md` file. Qualifying directories (and their `agents/` subdirectories) are passed to the Copilot SDK as `skillDirectories`. Skills can be installed from git repos via `io skill add <repo-url>`, listed, removed, or discovered through the `skills.sh` registry.

### Store

SQLite database via `better-sqlite3` (`src/store/db.ts`), stored at `~/.io/io.db` with WAL mode. Tables:

- **`io_state`** — key-value store for session IDs and config state
- **`squads`** — squad metadata (slug, name, project path, Copilot session ID, status, universe)
- **`squad_agents`** — named specialist agents per squad (character name, role title, charter, model tier, status)
- **`squad_decisions`** — persistent decision log per squad
- **`conversation_log`** — rolling log of user/assistant messages (capped at 1000 rows)
- **`agent_tasks`** — background task tracking for squad agents
- **`unified_feed`** — combined feed of notifications and inbox items (replaces separate inbox_entries)
- **`squad_instances`** — parallel worktree instances for concurrent squad work
- **`instance_decisions`** — append-only decision log per instance (merged back on completion)
- **`squad_schedules`** — squad-scoped scheduled tasks
- **`io_schedules`** — IO-level scheduled tasks
- **`schedule_runs`** — execution history for scheduled tasks

### Instance Watchdog

`src/watchdog.ts` runs a background `setInterval` that monitors both the Node.js event loop and squad instances. **Event loop staleness** is detected by measuring how late each interval fires; a warning is logged at 30 s and the daemon exits at 60 s (overridable via `onFatal` for testing). **Instance staleness** is detected by checking the most recent `agent_tasks` activity for each non-terminal instance — instances with no task activity in the last 30 minutes are marked stale, and instances stuck in `merging` state for more than 5 minutes are aborted. The timer is `.unref()`'d so it never prevents clean shutdown.

### Interfaces

IO supports four simultaneous interfaces:

| Interface | Module                | Status    |
| --------- | --------------------- | --------- |
| TUI       | `src/tui/index.ts`    | Available |
| Telegram  | `src/telegram/bot.ts` | Available |
| Web UI    | Vue 3 frontend        | Available |
| Web API   | `src/api/server.ts`   | Available |

All interfaces feed messages into the same orchestrator queue via `sendToOrchestrator()` with a `MessageSource` tag indicating origin (`telegram`, `tui`, or `background`).

## Copilot SDK Integration

- **`CopilotClient`** singleton manages the SDK lifecycle (`autoStart`, `autoRestart`)
- Sessions use **`infiniteSessions`** for automatic context compaction (background at 80%, buffer exhaustion at 95%)
- Tools are registered via **`defineTool()`** with Zod schemas for parameter validation
- Model selection defaults to `claude-sonnet-4.6` and is validated against available models at startup
- **Model tiers** (`modelTiers`) enable smart routing — the orchestrator picks a model from `high`, `medium`, or `low` tier based on task complexity
- **Session fingerprinting** — a SHA-256 hash of the version and tool names is stored in the DB; when IO upgrades or tools change, stale sessions are discarded and fresh sessions are created
- Streaming is enabled on the orchestrator session; agent sessions run without streaming
- Permissions are auto-approved via `approveAll` for both orchestrator and agent sessions

## Data Flow

1. **Message arrives** from any interface (Telegram, TUI, or Web API)
2. **Orchestrator receives it** via `sendToOrchestrator()`, which tags it with the source and enqueues it
3. **Serial processing**: messages are processed one at a time through `executeOnSession()`
4. **Routing decision**: the LLM decides to handle directly or delegate to a squad via `delegateToAgent()`
5. **If squad**: creates or resumes a worker agent session with project-specific context and tools
6. **Tools execute** (wiki, shell, file_ops, web_fetch, squad management, etc.)
7. **Response streams back** to the originating interface via the message callback
