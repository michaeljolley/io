---
title: Architecture Overview
description: How IO is structured
---

## System Architecture

IO is a monorepo with the following packages:

```
io/
├── packages/
│   ├── daemon/      # Core: orchestrator, squads, API server
│   ├── shared/      # Shared types and constants
│   ├── web/         # Web dashboard (React + Vite + Tailwind)
│   ├── tui/         # Terminal UI (Ink)
│   └── telegram/    # Telegram bot client
└── docs/            # This documentation (Astro Starlight)
```

## Core Components

### Daemon

The daemon is the heart of IO. It runs continuously and manages:

- **Copilot SDK Client** — Connects to GitHub Copilot for LLM interactions
- **Orchestrator** — Persistent session that routes messages and manages conversations
- **Squad Manager** — CRUD operations for agent squads
- **Instance Runner** — Executes squad work (meetings, tasks, PRs)
- **API Server** — Express HTTP + WebSocket for client connections
- **Event Bus** — Typed pub/sub for cross-component communication

### Communication Flow

```
User → (TUI | Telegram | Web Dashboard | REST) → WebSocket → Daemon
  ↓
Orchestrator (LLM decides: answer directly or delegate)
  ↓                           ↓
Direct Response          Squad Delegation
  ↓                           ↓
Client ← WebSocket     Team Lead → Agents → PR
```

### Data Storage

- **SQLite** (`~/.io/io.db`) — Conversations, squads, instances, token usage, activity logs
- **Disk** (`~/.io/squads/`) — SKILL.md files defining agent roles
- **Disk** (`~/.io/source/`) — Cloned project repos (`{owner}/{repo}`)
- **Disk** (`~/.io/wiki/`) — Knowledge base pages (io, shared, per-squad)
- **Disk** (`~/.io/attachments/`) — Uploaded files
- **Git Worktrees** — Isolated working copies per squad instance

## Key Patterns

| Pattern | Source | Description |
|---------|--------|-------------|
| Serialized message queue | Max | One-at-a-time LLM calls prevent race conditions |
| Event bus with error isolation | Squad | Handlers can't crash each other |
| SKILL.md agent identity | Squad | Markdown → system prompt + tool allowlist |
| Progressive streaming | IO | Token deltas accumulate, clients replace-in-place |
| Health monitor + reconnect | IO | 30s periodic check, auto-reset on failure |
