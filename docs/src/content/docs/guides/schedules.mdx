---
title: Schedules
description: Automate recurring tasks with cron-based schedules
---

Schedules let you trigger squads or the orchestrator on a cron schedule. Use them for daily standups, issue triage, periodic reports, or any recurring automation.

## How It Works

1. You define a schedule with a cron expression, a target (squad or orchestrator), and a prompt
2. The scheduler engine checks every 60 seconds for due schedules
3. When a schedule fires, it sends the prompt to the target
4. Results are posted to your inbox as deliverables

## Creating Schedules

### Via the Orchestrator

Ask IO naturally:

> "Create a daily standup schedule for the my-app squad at 9am on weekdays. Have it review open issues and report progress."

IO uses the `create_schedule` tool to set it up.

### Via REST API

```bash
curl -X POST http://localhost:7777/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Standup",
    "targetType": "squad",
    "targetId": "squad-uuid",
    "cron": "0 9 * * 1-5",
    "prompt": "Review all open issues. Summarize progress on in-flight work. Flag any blockers."
  }'
```

## Cron Syntax

Standard 5-field cron expressions:

```
┌───────── minute (0-59)
│ ┌─────── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌─── month (1-12)
│ │ │ │ ┌─ day of week (0-7, Sun=0 or 7)
│ │ │ │ │
* * * * *
```

**Examples:**

| Expression | Meaning |
|---|---|
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 */4 * * *` | Every 4 hours |
| `30 8 * * 1` | Mondays at 8:30 AM |
| `0 0 1 * *` | First day of each month at midnight |
| `*/30 * * * *` | Every 30 minutes |

## Managing Schedules

### List Schedules

```bash
curl http://localhost:7777/api/schedules
```

Or ask IO: *"What schedules do I have?"*

### Update a Schedule

```bash
curl -X PATCH http://localhost:7777/api/schedules/:id \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Updatable fields: `name`, `cron`, `prompt`, `enabled`.

### Delete a Schedule

```bash
curl -X DELETE http://localhost:7777/api/schedules/:id
```

Or ask IO: *"Delete the daily standup schedule"*

## Target Types

### Squad Target

When `targetType` is `"squad"`, the scheduler calls `runInstance` on that squad with the prompt as the objective. The squad's team lead receives the prompt and coordinates the agents.

### Orchestrator Target

When `targetType` is `"orchestrator"`, the scheduler sends the prompt directly to the orchestrator as a message. Use this for reminders or tasks that don't belong to a specific squad.

## Schedule Results

After a schedule fires, its result (success or failure) is posted to your inbox as a deliverable. You'll see:

- What schedule fired
- When it ran
- Summary of the result or error details

## Events

Schedule events are emitted on the event bus and broadcast via WebSocket:

- `schedule:fired` — A schedule has been triggered
- `schedule:completed` — The triggered task finished successfully
- `schedule:failed` — The triggered task encountered an error
