---
title: WebSocket Protocol
description: Real-time streaming protocol
---

## Connection

Connect to the WebSocket server:

```
ws://localhost:7777/ws
```

Upon connection, you'll receive a welcome message with your connection ID:

```json
{
  "type": "connected",
  "connectionId": "uuid-assigned-by-server"
}
```

## Sending Messages

Send a JSON message to forward text to the orchestrator:

```json
{
  "type": "message",
  "content": "Hello, IO!",
  "source": "tui"
}
```

The `source` field should be one of: `tui`, `telegram`, `web`.

## Receiving Messages

### Streaming Deltas

As the LLM generates tokens, you receive accumulated content:

```json
{
  "type": "delta",
  "content": "Hello! How can I"
}
```

```json
{
  "type": "delta",
  "content": "Hello! How can I help you"
}
```

Each delta contains the **full accumulated text** so far — clients should replace (not append) their display.

### Complete Message

When generation finishes:

```json
{
  "type": "message",
  "content": "Hello! How can I help you today?"
}
```

### Errors

```json
{
  "type": "error",
  "content": "Failed to process message"
}
```

### Event Notifications

Squad/agent/instance events are broadcast to all connected clients:

```json
{
  "type": "event",
  "event": {
    "type": "instance:pr_created",
    "id": "evt-uuid",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "squadId": "squad-123",
    "instanceId": "instance-456",
    "data": {
      "prUrl": "https://github.com/user/repo/pull/42"
    }
  }
}
```

### Inbox Notifications

New inbox entries (deliverables or blocking questions) trigger a notification:

```json
{
  "type": "notification",
  "content": "📥 [my-app] New question: Database choice needed"
}
```

### Schedule Notifications

Schedule lifecycle events:

```json
{
  "type": "notification",
  "content": "⏰ Schedule fired: Daily Standup → squad my-app"
}
```

```json
{
  "type": "notification",
  "content": "✅ Schedule completed: Daily Standup"
}
```

## Client Implementation Example

```typescript
const ws = new WebSocket('ws://localhost:7777/ws');

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  switch (msg.type) {
    case 'connected':
      console.log('Connected:', msg.connectionId);
      break;
    case 'delta':
      // Replace displayed text with accumulated content
      updateDisplay(msg.content);
      break;
    case 'message':
      // Final complete message
      finalizeDisplay(msg.content);
      break;
    case 'event':
      // Squad/instance event notification
      handleEvent(msg.event);
      break;
    case 'error':
      showError(msg.content);
      break;
  }
});

// Send a message
ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello!',
  source: 'web'
}));
```
