# Execution Pipeline

When a squad receives an objective, it follows a structured pipeline from planning to delivery.

## Pipeline Stages

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Objective  │────▶│   Planning   │────▶│    Tasks     │
│  (from Io)   │     │ (Team Lead)  │     │ (assigned)   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│      PR      │◀────│   QA Gate    │◀────│  Execution   │
│  (delivery)  │     │   (veto)     │     │  (parallel)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

## 1. Objective

An objective is a high-level goal, e.g., "Add dark mode to the settings page."

Objectives come from:
- Direct delegation by Io
- Scheduled tasks
- Inbox replies

## 2. Planning (Team Lead)

The Team Lead:
- Analyzes the current repo state
- Creates a structured plan
- Breaks the plan into discrete tasks
- Assigns tasks to agents by role
- Selects the cheapest capable model for each task

## 3. Task Execution (Parallel)

Each agent:
- Gets their own Copilot SDK session
- Works in an isolated git worktree
- Has full coding tools (read, edit, run, search)
- Has access to configured MCP servers
- Reports progress via the event bus

Agents execute **in parallel** — multiple tasks happen simultaneously.

## 4. Review Meeting

After all agents complete:
- A review session identifies conflicts or issues
- Agents can flag concerns about other agents' work
- The combined diff is prepared for QA

## 5. QA Gate

The QA agent:
- Reviews the full combined diff
- Runs tests if available
- Approves or rejects with reasons

**QA has veto power.** If rejected:
- Feedback sent back to relevant agents
- Agents revise their work
- Maximum **3 revision cycles**
- After 3 rejections → escalated to inbox

## 6. Delivery

Based on the squad's [PR mode](/squads/pr-modes):
- Branch is **always** pushed (regardless of mode)
- PR may be created as draft, ready, or auto-merged
- Result posted to the inbox
- Notification sent via Telegram/WebSocket

## Token Usage

Every agent session tracks token usage:
- Input/output tokens per agent per task
- Rolled up per squad and per objective
- Visible in the Usage view on the dashboard
