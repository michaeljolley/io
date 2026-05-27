# Wiki & Knowledge

IO includes a filesystem-based knowledge base for persistent memory across sessions.

## Location

```
~/.io/wiki/
└── pages/
    ├── notes/
    │   └── preferences.md
    ├── squads/
    │   ├── squad-alpha/
    │   │   └── decisions.md
    │   └── squad-beta/
    │       └── architecture.md
    └── workflows/
        └── deployment.md
```

## Usage

The wiki is accessible via tools in the orchestrator:

| Tool | Description |
| --- | --- |
| `wiki_read` | Read a page by path |
| `wiki_write` | Create or update a page |
| `wiki_list` | List all pages |
| `wiki_search` | Search by keyword |
| `wiki_delete` | Delete a page |

## Squad Wikis

Each squad can have its own wiki space under `pages/squads/{squad-name}/`. This is used to store:
- Architectural decisions
- Project conventions
- Meeting notes
- Design documents

Squad wiki content is included in agent prompts when they are spawned.

## Web Interface

The Wiki view in the web dashboard provides:
- File tree navigation (left panel)
- Markdown content display (right panel)
- Edit mode with raw Markdown editor
- Create and delete pages
- Full-text search

## Best Practices

- Use the wiki for information that should persist across sessions
- Store user preferences, workflow rules, and project notes
- Organize by topic in subdirectories
- Keep pages focused and concise
