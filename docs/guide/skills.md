# Skills

Skills extend Io and squad agents with additional capabilities defined in SKILL.md files.

## What is a Skill?

A skill is a markdown file (`SKILL.md`) with YAML frontmatter that describes:

- When to activate the skill
- What instructions to inject into the system prompt
- What tools or behaviors it adds

## Installing Skills

### From GitHub

```bash
# Via IO's chat
"Install the skill from https://github.com/user/repo/tree/main/skills/my-skill"

# Via API
curl -X POST http://localhost:7777/api/skills/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/user/repo/tree/main/skills/my-skill"}'
```

### From skills.sh

```bash
"Search for a frontend design skill"
"Install the frontend-design skill from skills.sh"
```

### Manual

Place a `SKILL.md` file in `~/.io/skills/your-skill/SKILL.md`.

## Skill Format

```markdown
---
name: my-skill
description: Helps with XYZ tasks
activation: When the user asks about XYZ
---

# My Skill

Instructions for the AI when this skill is active...

## Guidelines

- Do X
- Don't do Y
- Always consider Z
```

## Managing Skills

| Action | Method |
|--------|--------|
| List installed | `io skill list` or GET `/api/skills` |
| Search marketplace | GET `/api/skills/discover?source=skillssh&q=query` |
| Install | POST `/api/skills/install` |
| Remove | DELETE `/api/skills/:id` |

## Skills for Agents

Skills aren't just for Io — squad agents also load applicable skills into their system prompts. This lets you give specialized instructions to specific agent roles.
