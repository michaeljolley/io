# Architecture Overview

IO is a daemon process that acts as a hub between multiple input channels and the GitHub Copilot SDK.

## High-Level Diagram

```
User → [Web Dashboard / Telegram / HTTP API]
                ↓
         Orchestrator (Copilot SDK)
          ↕           ↕          ↕
     Squad Manager   Wiki/Memory  MCP Servers
          ↓
     Named Agents (Pop Culture Characters)
```

## Core Components

### Copilot Client
A singleton `CopilotClient` instance manages the connection to the Copilot runtime. It auto-starts and auto-reconnects on failure. A health check pings every 30 seconds.

### Orchestrator
The orchestrator maintains a **persistent session** with the Copilot SDK. It:
- Serializes all inbound messages through a queue (one at a time)
- Streams responses via Server-Sent Events
- Persists the session ID in SQLite for resume on restart
- Supports infinite sessions with automatic context compaction

### Message Queue
All input channels (Telegram, HTTP API, schedulers) feed into a single message queue. Messages are tagged with their source and processed sequentially to avoid race conditions.

### Tools
Tools are defined using the SDK's `defineTool()` factory with Zod schemas. The orchestrator has access to all tools; squad agents get a filtered subset.

## Data Flow

1. **Input** arrives from any channel (web, Telegram, scheduler)
2. **Queue** serializes messages onto the orchestrator session
3. **Orchestrator** processes via the Copilot SDK (may invoke tools)
4. **Tools** interact with squads, wiki, feed, MCP servers, etc.
5. **Response** streams back to the originating channel via SSE
6. **Notifications** push to other channels (e.g., Telegram) as configured

## Persistence

| Store | Technology | Purpose |
| --- | --- | --- |
| Configuration | JSON file | User settings |
| Squads, tasks, feed | SQLite (WAL mode) | Structured data |
| Wiki | Filesystem (Markdown) | Knowledge base |
| MCP config | JSON file | Server definitions |
| Sessions | Copilot SDK internal | Conversation state |
