---
title: Wiki Knowledge Base
description: Persistent project knowledge that makes squads smarter over time
---

IO includes a file-based wiki system that gives squads persistent memory about their projects. Agents can read and write wiki pages during execution, building up project knowledge that persists across instances.

## How It Works

The wiki is organized into three scopes:

```
~/.io/wiki/
├── io/          # Orchestrator-private knowledge
├── shared/      # Readable by all squads, writable by orchestrator + you
└── squads/
    ├── my-app/  # Squad-specific knowledge
    └── api/     # Each squad gets its own folder
```

### Scopes

| Scope | Who reads | Who writes |
|-------|-----------|-----------|
| `io/` | Orchestrator only | Orchestrator + you (manually) |
| `shared/` | All squads + orchestrator | Orchestrator + you (manually) |
| `squads/{name}/` | That specific squad | That specific squad's agents |

## Agent Interaction

Agents interact with the wiki through three tools:

### `read_wiki`
List pages in a scope or read a specific page.

```
read_wiki(scope: "squad", pageName: "conventions")
→ Returns the page content

read_wiki(scope: "shared")
→ Returns list of all page names in shared wiki
```

### `write_wiki`
Create or overwrite a wiki page. Agents should read existing content first and merge when updating.

```
write_wiki(pageName: "architecture", content: "# Architecture\n\nThis project uses...")
```

### `search_wiki`
Search across all accessible pages by keyword.

```
search_wiki(keyword: "database")
→ Returns matching pages with context lines
```

## Page Title Injection

Agents see a listing of available wiki page names in their system prompt so they know what knowledge exists. This is lightweight (just filenames) and helps agents decide when to call `read_wiki`.

## Creating Knowledge

Agents write wiki pages automatically when they discover important project knowledge:

- Architecture patterns and conventions
- Dependency information
- Deployment procedures
- Common gotchas or edge cases
- API contracts and data models

There's no approval step — wiki writes are treated as internal memory, not code.

## Update Strategy

When updating an existing page, agents follow a **merge** strategy:
1. Read the existing page with `read_wiki`
2. Synthesize old content with new discoveries
3. Write the complete updated page with `write_wiki`

This keeps pages clean and consolidated rather than endlessly appending.

## Manual Editing

You can create and edit wiki pages directly on disk:

```bash
# Add shared knowledge
echo "# Coding Standards\n\nAlways use TypeScript strict mode." > ~/.io/wiki/shared/coding-standards.md

# Add squad-specific knowledge
echo "# Deploy Process\n\nRun deploy.sh from the project root." > ~/.io/wiki/squads/my-app/deployment.md
```

Or ask the orchestrator:

> "Add to the shared wiki: we always use PostgreSQL for new services"

## REST API

```bash
# List pages in a scope
curl http://localhost:7777/api/wiki/shared

# Read a specific page
curl http://localhost:7777/api/wiki/squads/my-app/architecture

# Write a page
curl -X PUT http://localhost:7777/api/wiki/shared/conventions \
  -H "Content-Type: application/json" \
  -d '{"content": "# Conventions\n\n- Use TypeScript strict mode\n- Prefer composition over inheritance"}'

# Search across scopes
curl "http://localhost:7777/api/wiki?q=database&scopes=shared,my-app"
```
