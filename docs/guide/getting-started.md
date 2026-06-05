# Getting Started

## Prerequisites

- **Node.js** ≥ 22
- **GitHub Copilot** subscription (Individual or Business)
- **Git** installed and configured

## Installation

### From npm

```bash
npm install -g heyio
```

### From source

```bash
git clone https://github.com/michaeljolley/io.git
cd io
npm install
npm run build
npm link
```

## Initial Setup

Run the interactive setup wizard:

```bash
io setup
```

This will:

1. Create the `~/.io/` data directory
2. Generate a default `config.json`
3. Prompt for optional Telegram bot token
4. Prompt for optional Supabase credentials

## Starting the Daemon

```bash
io start
```

IO will boot and be available at `http://localhost:7777`.

### Run in Background

```bash
io start &
```

Or use a process manager like `pm2`:

```bash
pm2 start "io start" --name io
```

## First Interaction

Open your browser to `http://localhost:7777` and start chatting with Io. Try:

- "What can you do?"
- "Remember that my preferred language is TypeScript"
- "Hire a squad for https://github.com/myorg/myrepo"

## Project Structure

After installation, IO creates the following at `~/.io/`:

```
~/.io/
├── config.json      # Configuration
├── io.db            # SQLite database
├── wiki/
│   └── pages/       # Knowledge base markdown files
├── skills/          # Installed SKILL.md files
└── logs/
    └── io.log       # Application logs
```

## Next Steps

- [Configure IO](/guide/configuration) for your environment
- Learn about [Chat & Orchestration](/guide/chat)
- [Hire your first squad](/squads/hiring)
