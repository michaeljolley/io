# What is IO?

IO is a self-hosted AI orchestrator daemon that acts as your personal companion — always running, accessible via Telegram and a web dashboard. It manages specialized squads of AI agents that handle project work autonomously.

## Core Concepts

### Io (The Orchestrator)

Io is your main point of contact. It:

- Answers questions directly when no squad is relevant
- Delegates project-specific work to the appropriate squad
- Manages a personal wiki for long-term memory
- Runs scheduled tasks via a cron engine
- Routes messages to the optimal model tier (fast/standard/premium)

### Squads

A squad is a team of AI agents assigned to a single repository. Each squad has:

- **Team Lead** — Plans objectives, assigns tasks, picks models
- **QA Agent** — Reviews work with veto power (max 3 revision cycles)
- **Specialized Agents** — LLM-generated roles based on your codebase (e.g., Frontend Dev, API Engineer, DevOps)

### Execution Pipeline

When work is delegated to a squad:

```
Objective → Team Lead Plans → Tasks Assigned
  → Agents Execute in Parallel (git worktrees)
    → Review Meeting
      → QA Approval/Rejection
        → PR Created → Inbox Notification
```

## Design Principles

- **No universes or characters** — Agents have roles, not personas
- **One squad per repo** — Clear ownership, no cross-squad coordination
- **Human oversight** — QA gates, inbox notifications, configurable PR modes
- **Smart model routing** — Use the cheapest capable model for each task
- **Always-on** — Daemon runs persistently, accessible from anywhere via Telegram or web
