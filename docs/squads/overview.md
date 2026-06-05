# Squads Overview

Squads are teams of specialized AI agents assigned to a single repository. Once a squad is hired, Io delegates all work related to that repository to the squad automatically.

## Composition

Every squad has two mandatory roles plus LLM-generated specialists:

| Role | Mandatory | Purpose |
|------|-----------|---------|
| **Team Lead** | ✅ | Plans objectives, assigns tasks, picks models |
| **QA Agent** | ✅ | Reviews work, runs tests, has veto power |
| *Specialists* | Generated | Roles tailored to the repo (e.g., Frontend Dev, API Engineer) |

## Key Principles

- **One squad per repo** — Each repository gets exactly one squad
- **No characters** — Agents have functional roles, not personas or universe themes
- **Delegation is automatic** — Once a squad exists, Io routes relevant work there
- **Human oversight** — QA gates, configurable PR modes, inbox notifications

## Squad Lifecycle

```
1. Hire   → Io analyzes repo → proposes team → user approves
2. Active → Squad handles all work for that repo
3. Fire   → Squad disbanded, Io handles repo directly again
```

## Management

Manage squads via chat, API, or web dashboard:

```
"Hire a squad for https://github.com/org/my-app"
"What's the status of the my-app squad?"
"Fire the my-app squad"
```

## Configuration Per Squad

Each squad has independent settings:

- **PR Mode** — How completed work is delivered
- **MCP Servers** — Optional Model Context Protocol servers for agents
- **Members** — Add or remove specialist roles
