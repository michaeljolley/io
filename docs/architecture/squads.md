# Squads

Squads are persistent, per-project teams of specialized AI agents. Unlike ephemeral chat sessions, squads accumulate knowledge about your projects over time.

## Concepts

### Squad

A squad is a project workspace stored in SQLite. Each squad tracks a project path and is recalled whenever you work on that project. Squads are created via the `squad` tool when the orchestrator decides project-specific work is needed.

### CopilotSession (Worker Agent)

Each squad member gets a `CopilotSession` — a long-lived worker agent backed by the Copilot SDK. The session receives the project path and accumulated decisions as context, enabling continuity across conversations. Sessions are persisted by storing the `copilot_session_id` in the database and resuming when the squad is recalled.

### Decisions

Significant decisions are stored in the `squad_decisions` table and injected into the agent's system prompt on each session, so context is never lost.

## Data Model

Squads and their decisions are stored in SQLite:

```
squads
├── id              (INTEGER PRIMARY KEY)
├── slug            (TEXT UNIQUE)
├── name            (TEXT)
├── project_path    (TEXT)
├── copilot_session_id (TEXT, nullable)
├── status          (TEXT: idle | working | error)
├── created_at      (DATETIME)
└── updated_at      (DATETIME)

squad_decisions
├── id              (INTEGER PRIMARY KEY)
├── squad_slug      (TEXT → squads.slug)
├── decision        (TEXT)
├── context         (TEXT, nullable)
└── created_at      (DATETIME)
```

## Squad Lifecycle

```
1. New project → orchestrator creates a squad (via squad tool)
2. Task delegated → CopilotSession created with project context + decisions
3. Agent works → uses shell, file_ops, and squad_log_decision tools
4. Decision made → logged to squad_decisions table
5. Task complete → session persists, status returns to idle
6. Project revisited → session resumed with full decision history
```

## Agent Tools

Each worker agent session is equipped with three tools:

- **`shell`** — Run shell commands (git, build tools, etc.) with configurable timeout and working directory
- **`file_ops`** — Read, write, or list files on the local filesystem
- **`squad_log_decision`** — Persist an important decision so it survives across sessions

## Decision Log

Decisions are stored in the `squad_decisions` table and summarized when building agent context:

```
- [2025-05-06T10:30:00Z] Use bcrypt for password hashing instead of argon2 (Project already has bcrypt as a dependency)
- [2025-05-06T11:15:00Z] Use Node.js built-in test runner (node --test) with tsx for new test files — not Vitest or Jest (zero extra dependencies, native ESM support)
```

The `getDecisionsSummary()` function formats the last 20 decisions into the agent's system prompt, providing an audit trail and enabling consistent decisions over time.

## Key Source Files

| File | Purpose |
| --- | --- |
| `src/store/squads.ts` | CRUD operations for squads and decisions |
| `src/copilot/agents.ts` | CopilotSession lifecycle, task delegation, agent tools |

## Cross-Squad Knowledge

Agents can share knowledge across squads through the [Knowledge System](/architecture/knowledge). This enables learnings from one project to benefit others — for example, a security best practice discovered in Project A can be applied to Project B.
