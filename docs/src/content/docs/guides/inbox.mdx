---
title: Inbox & Notifications
description: How squads communicate back to you
---

IO provides a two-layer communication system for squads to reach you:

- **Notifications** — ephemeral, real-time alerts pushed over WebSocket
- **Inbox** — persistent messages stored in the database until you act on them

## Inbox Entry Types

### Deliverables

Fire-and-forget messages from squads — status reports, completed task summaries, or schedule results. These sit in your inbox until you read them.

### Blocking Questions

When a squad needs a decision from you, it sends a **blocking question**. The squad pauses execution and waits for your response before continuing.

## Interacting with Your Inbox

### Via the Orchestrator

Simply talk to IO naturally:

> "What's in my inbox?"

IO will use the `list_inbox` tool to show your pending items. To respond to a blocking question:

> "Tell the my-app squad: yes, use PostgreSQL for the database"

IO routes your answer back using `respond_to_inbox`.

### Via REST API

```bash
# List inbox entries
curl http://localhost:7777/api/inbox

# List only unread entries
curl http://localhost:7777/api/inbox?status=unread

# Respond to a blocking question
curl -X POST http://localhost:7777/api/inbox/:id/respond \
  -H "Content-Type: application/json" \
  -d '{"response": "Use PostgreSQL"}'

# Mark as read
curl -X PATCH http://localhost:7777/api/inbox/:id \
  -H "Content-Type: application/json" \
  -d '{"status": "read"}'
```

### Via TUI

The TUI shows an unread badge indicator when you have pending inbox items.

### Via Telegram

Use the `/inbox` command to list pending entries and respond inline.

## WebSocket Events

Inbox events are broadcast to all connected WebSocket clients:

```json
{
  "type": "event",
  "event": {
    "type": "inbox:new_entry",
    "data": {
      "id": "entry-uuid",
      "kind": "question",
      "squadId": "squad-123",
      "title": "Database choice needed",
      "preview": "Should we use PostgreSQL or MySQL?"
    }
  }
}
```

## How Blocking Questions Work

1. A squad agent calls the `ask_user` tool during execution
2. IO creates an inbox entry with `kind: "question"` and pauses the agent
3. A notification is pushed to all clients (TUI badge, Telegram alert, WebSocket event)
4. You respond through any client — orchestrator chat, REST API, or Telegram
5. IO delivers your response back to the waiting agent, which resumes execution
