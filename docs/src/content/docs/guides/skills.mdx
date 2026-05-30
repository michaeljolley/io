---
title: Skills
description: Extend IO and squad capabilities with installable skills
---

Skills are markdown files (SKILL.md) that add additional instructions, behaviors, or knowledge to the orchestrator or specific squads. They're injected into system prompts when activated.

## How Skills Work

1. **Install** — download or create a skill in `~/.io/skills/{name}/SKILL.md`
2. **Activate** — assign it to the orchestrator or a specific squad
3. **Effect** — the skill content is injected into the target's system prompt

## Skill Format

A skill is simply a markdown file with instructions:

```markdown
# TDD Workflow

## Instructions
When implementing any feature or fix:
1. Write failing tests first
2. Implement the minimum code to pass
3. Refactor while keeping tests green
4. Never commit code without associated tests

## Boundaries
- Do not skip the test-first step, even for "simple" changes
- Integration tests are required for API endpoints
- Unit tests are required for business logic
```

Skills can contain any instructions, conventions, or behavioral guidance.

## Installing Skills

### Via the Orchestrator

> "Install a skill called tdd-workflow from https://raw.githubusercontent.com/user/skills/main/tdd/SKILL.md"

### Via REST API

```bash
# Install from URL
curl -X POST http://localhost:7777/api/skills/install \
  -H "Content-Type: application/json" \
  -d '{"name": "tdd-workflow", "url": "https://raw.githubusercontent.com/user/skills/main/tdd/SKILL.md"}'

# Install from content directly
curl -X POST http://localhost:7777/api/skills/install \
  -H "Content-Type: application/json" \
  -d '{"name": "code-style", "content": "# Code Style\n\n- Use tabs for indentation\n- Max line length: 100"}'
```

### Manually

Drop a folder into `~/.io/skills/`:

```
~/.io/skills/
└── tdd-workflow/
    └── SKILL.md
```

## Activating Skills

Skills must be activated to take effect. They can be activated for:

- **Orchestrator** — affects IO's behavior globally
- **A specific squad** — affects all agents in that squad

### Via the Orchestrator

> "Activate the tdd-workflow skill for the my-app squad"

> "Activate the code-style skill for yourself"

### Via REST API

```bash
# Activate for orchestrator
curl -X POST http://localhost:7777/api/skills/tdd-workflow/activate \
  -H "Content-Type: application/json" \
  -d '{"targetType": "orchestrator"}'

# Activate for a squad
curl -X POST http://localhost:7777/api/skills/tdd-workflow/activate \
  -H "Content-Type: application/json" \
  -d '{"targetType": "squad", "targetId": "squad-uuid"}'
```

## Managing Skills

### List Skills

```bash
curl http://localhost:7777/api/skills
```

Or ask IO: *"What skills are installed?"*

### Deactivate a Skill

```bash
curl -X POST http://localhost:7777/api/skills/tdd-workflow/deactivate \
  -H "Content-Type: application/json" \
  -d '{"targetType": "orchestrator"}'
```

### Remove a Skill

```bash
curl -X DELETE http://localhost:7777/api/skills/tdd-workflow
```

Or ask IO: *"Remove the tdd-workflow skill"*

## Use Cases

| Skill | Target | Purpose |
|-------|--------|---------|
| `tdd-workflow` | Squad | Force test-driven development |
| `code-style` | Squad | Enforce project-specific style rules |
| `response-tone` | Orchestrator | Customize how IO talks to you |
| `security-review` | Squad | Extra security checks on every PR |
| `daily-summary` | Orchestrator | Template for daily status reports |

## Storage

```
~/.io/skills/
├── tdd-workflow/
│   └── SKILL.md
├── code-style/
│   └── SKILL.md
└── security-review/
    └── SKILL.md
```

Activation state is stored in SQLite (persists across restarts).
