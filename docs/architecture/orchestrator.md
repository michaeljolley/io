# Orchestrator

The orchestrator is IO's brain — a persistent Copilot SDK session that processes all messages and coordinates tools.

## Session Lifecycle

```
Daemon Start
  ├─ getClient() → CopilotClient singleton
  ├─ createOrResumeSession()
  │     ├─ Check SQLite for saved session ID
  │     ├─ Try resumeSession(savedId) → success? done
  │     └─ Fall back to createSession() → save new ID
  ├─ startHealthCheck() → ping every 30s
  └─ Ready to process messages
```

## Session Configuration

```typescript
{
  model: config.defaultModel,
  streaming: true,
  workingDirectory: process.cwd(),
  systemMessage: { content: buildSystemMessage(selfEdit) },
  tools: createTools(),
  skillDirectories: loadSkillDirectories(),
  onPermissionRequest: approveAll,
  infiniteSessions: {
    enabled: true,
    backgroundCompactionThreshold: 0.8,
    bufferExhaustionThreshold: 0.95,
  },
}
```

## Message Queue

Messages are processed sequentially:

```
sendToOrchestrator(prompt, source, callback, attachments?)
  └─ Enqueue → processQueue()
       └─ executeOnSession()
            ├─ Subscribe to "assistant.message_delta" (streaming)
            ├─ session.sendAndWait({ prompt: taggedPrompt, attachments }, 600_000ms)
            └─ callback(finalContent, true)
```

Each message is tagged with its source: `[via telegram]`, `[via web]`, `[via scheduler]`, etc.


## Attachments + Multimodal Flow

Web chat attachments are validated at the API boundary and passed through the orchestrator queue as `MessageAttachment[]` objects (`name`, `mimeType`, `size`, `content`).

At send time, attachments are converted to Copilot SDK blob attachments so vision-capable models can receive image bytes directly. The current message attachments are also made available to orchestrator tool handlers, so squad delegation/meeting tool calls can pass the same attachment payload to squad lead sessions.

## Streaming

When `streaming: true` is set on the session, the orchestrator subscribes to `assistant.message_delta` events. Partial content is pushed to the callback as it arrives, enabling real-time display in the web dashboard and Telegram.

## Health Check

A 30-second interval pings the Copilot client. On failure:
1. Reset the client connection
2. Clear the orchestrator session reference
3. Next message will trigger a fresh session creation

## System Message

The system message is dynamically assembled at session creation time and includes:
- IO identity and behavioral rules
- Squad coverage requirements
- GitHub self-review limitation workaround
- Self-edit protection block (unless `--self-edit`)
- Environment info (OS, working directory, paths)

## Background Agent Results

When a squad agent completes a task, the result is fed back into the orchestrator as a new message:

```typescript
feedAgentResult(taskId, agentName, result, callback)
// → "[Agent task completed] @agentName finished task ..."
```

This allows the orchestrator to acknowledge completions and notify the user.
