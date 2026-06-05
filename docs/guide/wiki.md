# Wiki

IO's wiki is a personal knowledge base stored as markdown files. Io uses it for long-term memory and context enrichment.

## Location

Wiki pages live at `~/.io/wiki/pages/`.

## Structure

```
wiki/pages/
├── people/
│   ├── alice.md
│   └── bob.md
├── projects/
│   ├── my-app.md
│   └── api-service.md
├── conversations/
│   ├── 2024-12-01.md
│   └── 2024-12-02.md
└── notes/
    └── deployment-checklist.md
```

## Page Format

Pages use YAML frontmatter with markdown content:

```markdown
---
title: My App
tags: [project, typescript, react]
created: 2024-12-01
updated: 2024-12-15
---

# My App

A React dashboard for managing widgets.

## Tech Stack
- React 18 + TypeScript
- Tailwind CSS
- Express API backend

## Key Decisions
- Using [[zustand]] for state management
- API deployed on [[railway]]
```

## Features

- **Tags** — Categorize pages for quick filtering
- **Wiki Links** — `[[page-name]]` syntax for cross-references
- **Auto-context** — Relevant pages are injected into Io's system prompt
- **Episode summaries** — Daily conversation summaries auto-generated

## Tools

Io has built-in tools for wiki management:

| Tool | Description |
|------|-------------|
| `remember` | Quick-write a fact to the wiki |
| `recall` | Quick-search the wiki |
| `wiki_read` | Read a specific page |
| `wiki_write` | Create or update a page |
| `wiki_search` | Search by keyword or tag |

## API

You can also manage wiki pages via the REST API:

```bash
# List pages
curl http://localhost:7777/api/wiki/pages

# Get a page
curl http://localhost:7777/api/wiki/pages/projects/my-app

# Search
curl http://localhost:7777/api/wiki/search?q=typescript
```
