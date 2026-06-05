# Chat & Orchestration

Io is your primary point of contact. Every message you send — whether via the web dashboard or Telegram — goes through Io's orchestrator.

## How It Works

1. **Message received** → Router classifies complexity tier
2. **Model selected** → Fast, standard, or premium based on classification
3. **System prompt built** → Includes wiki context, squad roster, active skills
4. **Decision made** → Answer directly OR delegate to a squad

## Direct Mode

When no squad exists for the relevant repository (or the question isn't project-specific), Io answers directly with its full tool set:

- File reading/editing
- Running commands
- Git operations
- Code search
- Wiki management
- Scheduling

## Delegation Mode

When a squad exists for the repository in question, Io delegates automatically:

```
You: "Add dark mode to the settings page in my-app"
Io:  "I'll delegate this to the my-app squad..."
     → Creates objective → Squad executes → Results in inbox
```

## Rolling Window Reset

To maintain context quality over long conversations, Io uses a rolling window:

1. After N messages (default: 50), the session resets
2. Before reset, the conversation is summarized
3. Summary is saved as a wiki episode (`conversations/YYYY-MM-DD.md`)
4. A fresh session starts, seeded with the summary + relevant wiki context

This ensures Io never loses important context while keeping the active window focused.

## Streaming

Responses stream in real-time via WebSocket (web) or Telegram message editing. You see tokens as they're generated.
