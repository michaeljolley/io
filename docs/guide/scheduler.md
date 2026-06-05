# Scheduler

IO includes a cron-based scheduling engine that runs recurring prompts automatically.

## How It Works

Every 60 seconds, the scheduler checks all registered schedules against the current time. When a schedule is due, its prompt is sent to Io as a regular message.

## Creating Schedules

### Via Chat

```
"Schedule a daily standup summary every morning at 9am"
"Every Friday at 5pm, remind me to review open PRs"
```

### Via API

```bash
curl -X POST http://localhost:7777/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Standup",
    "cron": "0 9 * * *",
    "prompt": "Summarize what the my-app squad accomplished yesterday",
    "enabled": true
  }'
```

## Cron Syntax

Standard 5-field cron expressions:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *
```

### Examples

| Expression | Schedule |
|------------|----------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `*/30 * * * *` | Every 30 minutes |
| `0 17 * * 5` | Fridays at 5:00 PM |
| `0 0 1 * *` | First of every month at midnight |

## Managing Schedules

Schedules can be managed via the web dashboard (Schedules view), chat, or API:

```bash
# List all schedules
curl http://localhost:7777/api/schedules

# Update a schedule
curl -X PUT http://localhost:7777/api/schedules/:id \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Delete a schedule
curl -X DELETE http://localhost:7777/api/schedules/:id
```
