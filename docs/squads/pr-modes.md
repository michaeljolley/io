# PR Modes

Each squad has a configurable PR mode that determines how completed work is delivered.

## Available Modes

| Mode | Behavior |
|------|----------|
| `branch-only` | Push branch, no PR created |
| `draft-pr` | Push branch + create draft PR |
| `ready-pr` | Push branch + create ready-for-review PR |
| `auto-merge` | Push branch + create PR + auto-merge if CI passes |

## Branch Always Pushed

Regardless of PR mode, the working branch is **always pushed** to the remote. This ensures:

- Work is never lost
- You can inspect the branch manually
- You can create a PR yourself later

## Configuring PR Mode

### Per Squad

```bash
# Via chat
"Set the my-app squad to draft-pr mode"

# Via API
curl -X PUT http://localhost:7777/api/squads/:id \
  -H "Content-Type: application/json" \
  -d '{"config": {"prMode": "draft-pr"}}'
```

### Default

New squads default to `draft-pr` mode — work is visible but requires human approval before merge.

## PR Content

Generated PRs include:

- **Title** — Derived from the objective
- **Description** — Objective, plan summary, agent work summaries
- **QA Status** — Approval details and test results
- **Labels** — Auto-applied based on the type of work

## Recommendations

| Scenario | Recommended Mode |
|----------|-----------------|
| Learning/experimenting | `branch-only` |
| Active development | `draft-pr` |
| Trusted squad, good CI | `ready-pr` |
| Fully automated workflows | `auto-merge` |
