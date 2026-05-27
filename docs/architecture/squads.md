# Squad System

Squads are persistent project teams with named specialist agents. They are the primary mechanism for delegating complex work.

## Concepts

### Squad
A squad is a team assigned to a specific project. Each squad has:
- A **name** (e.g., "Project Alpha")
- A **universe theme** (e.g., "A-Team", "Transformers", "ThunderCats")
- A **repo URL** (optional, for code work)
- **Rules** (squad-specific workflow rules)

### Agent
An agent is a team member with:
- A **character name** from the squad's universe
- A **role title** matching the project's stack (e.g., "Vue 3 Frontend Developer")
- **Flags**: lead, QA reviewer, test specialist
- A **persona** (personality/work style description)

### Instance
A parallel worktree for concurrent work. Max 3 per squad.

## Coverage Requirements

Every squad MUST have:
1. A **dedicated team lead** (coordination-only, no domain ownership)
2. At least one **QA reviewer** (holds veto power)
3. At least one **test specialist** (holds veto power)

## Universe Casting

::: warning
Universe names and character names are NEVER hardcoded. When creating a squad, IO researches the chosen universe dynamically to discover appropriate characters.
:::

## Task Delegation Flow

```
User: "Delegate this feature to the Alpha squad"
  ↓
squad_delegate tool invoked
  ↓
Find squad's team lead
  ↓
Classify task complexity → select model tier
  ↓
Create ephemeral agent session for lead
  ↓
Lead processes task (may break down and route to specialists)
  ↓
Result saved to tasks table + posted to feed
  ↓
Agent session destroyed
```

## Peer Review

When a task completes, other agents review and vote:
- **APPROVED** — agent agrees with the work
- **REJECTED** — agent identifies issues

### Veto Power
QA reviewers, test specialists, and the team lead hold veto power. Their rejection blocks merge.

### GitHub Self-Review Workaround
Since all agents share the repo owner's `gh` identity, GitHub blocks self-approval. Instead:
- Veto reviewers use `gh pr review --comment` with "LGTM"
- Merge criteria: all veto-capable members have posted approving comments + CI passes + no conflicts

## Parallel Instances

Squads support up to 3 concurrent instances for working multiple issues:
- Each instance gets a **git worktree** for file isolation
- Instance activity is tracked; stale instances (>30 min idle) are auto-destroyed by the watchdog
- When done, decisions merge back and the worktree is removed

## Model Routing

Agents don't have a stored model preference. Instead, the model is selected per-task:
- **High tier** — architecture, security, complex debugging
- **Medium tier** — features, tests, standard reviews
- **Low tier** — reads, formatting, simple lookups

This means a senior agent can be routed to a cheap model for trivial tasks.
