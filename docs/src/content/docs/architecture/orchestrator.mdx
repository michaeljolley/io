---
title: Orchestrator
description: The central AI brain of IO
---

## Overview

The orchestrator is a persistent Copilot SDK session that:
1. Receives user messages from any client
2. Decides whether to answer directly or delegate to a squad
3. Streams responses back token-by-token

## How It Works

### Session Management

IO creates a single persistent session with the Copilot SDK. This session maintains conversation history across messages, giving the LLM full context of prior interactions.

```typescript
// Simplified flow
const session = await client.createSession({
  agent: 'io-orchestrator',
  model: 'claude-opus-4.6',
  systemMessage: buildSystemMessage(), // includes squad registry
  tools: orchestratorTools,
});
```

### Message Queue

Messages are processed one at a time via a serialized queue. This prevents concurrent writes to the session which would corrupt state.

### Dynamic System Message

The system prompt is rebuilt to include the current squad registry. This gives the LLM awareness of which projects have assigned squads, enabling correct routing decisions.

### Routing Logic

The LLM uses tool-calling to express its routing decision:

- **Direct answer** — Responds inline for general questions
- **delegate_to_squad** — Forwards project-specific messages to the appropriate squad's team lead
- **hire_squad** — Creates a new squad when the user requests one
- **list_squads / get_squad_status** — Reports on squad state

## Tools Available

| Tool | Description |
|------|-------------|
| `list_squads` | List all active squads |
| `hire_squad` | Create a new squad for a project |
| `delegate_to_squad` | Send a message to a squad's team lead |
| `get_squad_status` | Get detailed status of a squad |
| `run_squad_instance` | Start a new work instance on a squad |

## Streaming

Responses stream token-by-token to connected clients via WebSocket. The accumulated text is sent with each delta, and clients replace their display content in-place.
