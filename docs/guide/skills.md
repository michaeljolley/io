# Skills

Skills are modular extensions that teach IO how to use external tools. Each skill is a directory containing a `SKILL.md` manifest.

## Managing Skills

```bash
# List installed skills
io skill list

# Install from a git repo
io skill add https://github.com/user/my-skill.git

# Remove a skill
io skill remove my-skill
```

## How Skills Work

Skills are installed to `~/.io/skills/`. At daemon startup, IO scans this directory and injects skill content into the orchestrator's system message. Squad agents also have access to skills when needed.

## Skill Format

A skill is a directory with a `SKILL.md` file:

```
my-skill/
└── SKILL.md
```

The `SKILL.md` file describes the skill:

```markdown
# My Skill

A brief description of what this skill does.

## Usage

Instructions for how to use this skill...

## Tools

Description of available tools and their parameters...
```

## Skill Discovery

- The first `# Heading` in `SKILL.md` becomes the skill name
- The first paragraph becomes the description
- The directory name becomes the slug

## Installation Sources

Skills can be installed from any git repository:

```bash
io skill add https://github.com/user/skill-name.git
io skill add git@github.com:user/skill-name.git
```

The repository must contain a `SKILL.md` file at its root.
