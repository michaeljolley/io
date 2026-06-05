# Model Routing

IO uses smart model routing to balance cost and capability. There are two routing contexts: Io's orchestrator and squad agents.

## Io's Model Router

For every incoming message, a lightweight classifier determines the complexity tier:

| Tier | When Used | Default Model |
|------|-----------|---------------|
| **Fast** | Simple questions, greetings, status checks | `gpt-4.1-mini` |
| **Standard** | Moderate tasks, code questions, discussions | `claude-sonnet-4.6` |
| **Premium** | Complex analysis, architecture, multi-step reasoning | `claude-sonnet-4.6` |

### Classification Method

1. Keyword overrides checked first (e.g., "hello" → fast)
2. If no override, a fast LLM call classifies the message
3. Cooldown prevents rapid tier switching (avoids oscillation)
4. Falls back to "standard" if classification is uncertain

## Team Lead Model Selection

When a Team Lead assigns tasks to agents, it picks the cheapest capable model:

- **Simple file edits** → Fast-tier model
- **Feature implementation** → Standard-tier model
- **Architecture/refactoring** → Premium-tier model

This is a heuristic classification based on task description — no additional LLM call is made for routing.

## Cost Optimization

The routing system aims to minimize cost while maintaining quality:

- ~60% of messages use the fast tier (cheap)
- ~30% use standard
- ~10% require premium

All token usage is tracked per-agent and viewable in the Usage dashboard.

## Overriding

You can configure model assignments in `~/.io/config.json`:

```json
{
  "models": {
    "fast": "gpt-4.1-mini",
    "standard": "claude-sonnet-4.6",
    "premium": "claude-sonnet-4.6"
  }
}
```
