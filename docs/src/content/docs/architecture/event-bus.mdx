---
title: Event Bus
description: Typed pub/sub for cross-component communication
---

## Overview

IO uses a typed event bus for loose coupling between components. Events are emitted by squads, agents, and instances, and consumed by:

- **Notification system** — Broadcasts to WebSocket clients
- **Activity logger** — Persists to SQLite for historical queries
- **Future consumers** — Metrics, alerting, etc.

## Event Types

### Squad Events

| Event | Emitted When |
|-------|-------------|
| `squad:created` | New squad is hired |
| `squad:disbanded` | Squad is removed |
| `squad:member_added` | New agent joins |
| `squad:member_retired` | Agent is removed |

### Agent Events

| Event | Emitted When |
|-------|-------------|
| `agent:task_started` | Agent begins a task |
| `agent:task_completed` | Agent finishes a task |
| `agent:tool_call` | Agent invokes a tool |
| `agent:error` | Agent encounters an error |
| `agent:permission_denied` | Autonomy check blocks action |

### Instance Events

| Event | Emitted When |
|-------|-------------|
| `instance:created` | New instance spawned |
| `instance:meeting_started` | Round-table begins |
| `instance:meeting_complete` | Consensus reached |
| `instance:work_started` | Task execution begins |
| `instance:pr_created` | PR submitted |
| `instance:complete` | Instance finished |
| `instance:failed` | Instance errored out |

### Meeting Events

| Event | Emitted When |
|-------|-------------|
| `meeting:contribution` | Agent speaks in meeting |
| `meeting:consensus_reached` | All agree on plan |
| `meeting:veto` | Veto member blocks proposal |

## Error Isolation

Handlers are wrapped in `Promise.allSettled()` — a failing handler cannot crash the bus or prevent other handlers from executing. Errors are logged but don't propagate.

## Usage

```typescript
import { getEventBus } from './squad/event-bus.js';

const bus = getEventBus();

// Subscribe to specific event type
const unsubscribe = bus.on('instance:complete', (event) => {
  console.log(`Instance ${event.instanceId} completed!`);
});

// Subscribe to all events
bus.onAny((event) => {
  console.log(event.type, event);
});

// Emit an event
await bus.emit({
  type: 'instance:complete',
  id: crypto.randomUUID(),
  timestamp: new Date(),
  squadId: 'my-squad',
  instanceId: 'instance-123',
});
```
