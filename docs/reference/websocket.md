# WebSocket Events

IO uses WebSocket for real-time communication with the web dashboard. Connect to:

```
ws://localhost:7777
```

## Event Format

All events are JSON messages with a `type` field:

```json
{
  "type": "event.name",
  "payload": { ... },
  "timestamp": "2024-12-01T10:00:00.000Z"
}
```

## Events

### Chat Events

| Event | Payload | Description |
|-------|---------|-------------|
| `chat.chunk` | `{ text, conversationId }` | Streaming token from Io |
| `chat.complete` | `{ conversationId, messageId }` | Response complete |
| `chat.error` | `{ error, conversationId }` | Error during generation |

### Squad Events

| Event | Payload | Description |
|-------|---------|-------------|
| `squad.objective.created` | `{ squadId, objectiveId, description }` | New objective assigned |
| `squad.task.started` | `{ squadId, taskId, agentRole }` | Agent started a task |
| `squad.task.completed` | `{ squadId, taskId, agentRole }` | Agent finished a task |
| `squad.review.started` | `{ squadId, objectiveId }` | Review meeting began |
| `squad.qa.approved` | `{ squadId, objectiveId }` | QA approved the work |
| `squad.qa.rejected` | `{ squadId, objectiveId, reason, cycle }` | QA rejected (includes cycle count) |
| `squad.pr.created` | `{ squadId, prUrl, prMode }` | PR created |
| `squad.escalated` | `{ squadId, objectiveId, reason }` | Escalated to inbox after 3 rejections |

### Agent Events

| Event | Payload | Description |
|-------|---------|-------------|
| `agent.executing` | `{ squadId, agentRole, taskId }` | Agent is actively working |
| `agent.tool_call` | `{ squadId, agentRole, tool }` | Agent called a tool |
| `agent.completed` | `{ squadId, agentRole, taskId }` | Agent finished |
| `agent.error` | `{ squadId, agentRole, error }` | Agent encountered an error |

### Inbox Events

| Event | Payload | Description |
|-------|---------|-------------|
| `inbox.new_item` | `{ id, type, title, squadId }` | New inbox item |
| `inbox.reply` | `{ id, message }` | Reply sent to inbox item |

### System Events

| Event | Payload | Description |
|-------|---------|-------------|
| `system.connected` | `{ version }` | WebSocket connected |
| `system.session_reset` | `{ conversationId }` | Rolling window reset occurred |

## Client Example

```javascript
const ws = new WebSocket('ws://localhost:7777');

ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);

  switch (type) {
    case 'chat.chunk':
      appendToChat(payload.text);
      break;
    case 'squad.pr.created':
      showNotification(`PR created: ${payload.prUrl}`);
      break;
    case 'inbox.new_item':
      refreshInbox();
      break;
  }
};
```
