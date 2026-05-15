# Contributing to IO

Thank you for your interest in contributing to IO — a personal AI assistant daemon built on the GitHub Copilot SDK! This guide will help you get started.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful and constructive in all interactions.

## Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node.js)
- **GitHub CLI** (`gh`) — authenticated via `gh auth login`
- **GitHub Copilot subscription** — required for the Copilot SDK

## Development Setup

```bash
# Clone the repository
git clone https://github.com/michaeljolley/io.git
cd io

# Install dependencies
npm install

# Run in development mode (watch for changes)
npm run dev

# Build for production
npm run build
```

### Available Scripts

| Script | Description |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run daemon in watch mode (auto-restart on changes) |
| `npm run daemon` | Run the daemon directly |
| `npm run tui` | Run the TUI directly |
| `npm test` | Run the test suite (Node.js built-in test runner via tsx) |

## Project Structure

```
src/
├── index.ts              # CLI entry point (commander)
├── daemon.ts             # Daemon startup and shutdown
├── config.ts             # Config loading from ~/.io/config.json
├── paths.ts              # Path constants (~/.io/ directories)
├── update.ts             # Self-update checker
├── copilot/              # Core Copilot SDK integration
│   ├── client.ts         # CopilotClient singleton
│   ├── orchestrator.ts   # Main session management + context compaction
│   ├── agents.ts         # Worker agent sessions for delegated tasks
│   ├── tools.ts          # Tool definitions (file, shell, wiki, etc.)
│   ├── skills.ts         # Skills loader (reads SKILL.md manifests)
│   └── system-message.ts # System prompt builder
├── store/                # Persistence layer
│   ├── db.ts             # SQLite database (better-sqlite3)
│   ├── squads.ts         # Squad CRUD operations
│   └── tasks.ts          # Agent task tracking
├── wiki/                 # Knowledge base
│   ├── fs.ts             # Wiki filesystem (read/write markdown)
│   └── search.ts         # Wiki search
├── telegram/             # Telegram interface
│   ├── bot.ts            # Grammy bot setup
│   └── handlers.ts       # Command and message handlers
├── tui/                  # Terminal interface
│   └── index.ts          # Readline-based TUI
└── api/                  # HTTP interface
    └── server.ts         # Express server with SSE streaming
```

## How to Add a New Tool

Tools are defined in `src/copilot/tools.ts`. Each tool follows the Copilot SDK tool format with a Zod schema for parameters.

### Steps

1. **Define the tool** in `src/copilot/tools.ts`:

   ```typescript
   import { z } from "zod";

   // Add your tool to the tools array
   {
     name: "my_tool",
     description: "Description of what the tool does",
     parameters: z.object({
       input: z.string().describe("What this parameter does"),
     }),
     async execute({ input }) {
       // Tool implementation
       return { result: "success" };
     },
   }
   ```

2. **Keep tools focused** — each tool should do one thing well. If you need complex behavior, consider breaking it into multiple tools.

3. **Return structured data** — tools should return JSON-serializable objects that the LLM can reason about.

4. **Handle errors gracefully** — catch exceptions and return meaningful error messages rather than letting them propagate.

## How to Create a Skill

Skills are modular extensions that add new tools to IO. Each skill lives in its own directory and is described by a `SKILL.md` manifest file.

### Skill Directory Structure

```
my-skill/
├── SKILL.md          # Manifest (required)
├── tools.ts          # Tool definitions
└── README.md         # Documentation (optional)
```

### SKILL.md Format

The `SKILL.md` file is a markdown file that describes the skill and its capabilities. It is read by the skills loader and included in the system prompt so the LLM knows what tools are available.

```markdown
# My Skill

Description of what this skill does.

## Tools

### tool_name

Description of the tool and when to use it.

**Parameters:**
- `param1` (string, required) — what this parameter does
- `param2` (number, optional) — what this parameter does
```

### Installing Skills

Skills can be installed from git repositories or the [skills.sh](https://skills.sh) registry:

```bash
# From a git repo
io skill add https://github.com/user/my-skill.git

# Search the registry
io skill search "keyword"
```

## Code Style

- **TypeScript strict mode** — the project uses `strict: true` in `tsconfig.json`
- **ESM modules** — use `import`/`export`, not `require()`
- **`.js` extensions in imports** — TypeScript ESM requires `.js` extensions in relative imports (e.g., `import { foo } from "./bar.js"`)
- **Zod for validation** — use Zod schemas for runtime validation of external data
- **No `any`** — prefer `unknown` and narrow with type guards

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/michaeljolley/io/issues) before opening a new one
- Include steps to reproduce, expected behavior, and actual behavior
- Include your Node.js version and OS

### Suggesting Features

Open an [issue](https://github.com/michaeljolley/io/issues) describing the feature, why it would be useful, and any implementation ideas.

### Submitting a Pull Request

1. **Fork** the repository
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/my-change
   ```
3. **Make your changes** — keep commits focused and atomic
4. **Ensure the project builds:**
   ```bash
   npm run build
   ```
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add calendar tool for scheduling
   ```
6. **Push** to your fork and **open a pull request** against `main`

### Commit Messages

This project uses Conventional Commits:

| Type | Description |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `ci` | CI/CD changes |
| `chore` | Maintenance tasks |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |

### Pull Request Guidelines

- Keep PRs focused — one logical change per PR
- Ensure CI passes
- Provide a clear description of what changed and why
- Link any related issues (e.g., "Fixes #123")

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
