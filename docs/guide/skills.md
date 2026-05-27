# Skills

Skills are modular extensions that teach IO how to use external tools. Each skill is a directory containing a `SKILL.md` manifest.

## Managing Skills

Skills are managed through the **web dashboard** under the Skills page:

- **View** all installed skills with name, description, and slug
- **Install** a new skill from a git repository URL (click **From Git**), or browse community skills (click **Discover**)
- **Create** a new skill directly in the browser (click **Create New**)
- **Edit** an existing skill's content by selecting it and clicking the pencil icon
- **Remove** skills you no longer need (hover over a skill card to reveal the delete button)

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

The Skills page has a **Discover** tab that lets you browse and install community skills from:

- **[awesome-copilot](https://github.com/github/awesome-copilot)** — a curated community collection of agent skills maintained on GitHub.
- **[skills.sh](https://skills.sh)** — a community skill registry.

### Using the Discover Tab

1. Open the **Skills** page in the web dashboard and click the **Discover** tab.
2. Select a source from the dropdown (`awesome-copilot` or `skills.sh`).
3. Optionally enter a search term and click **Search**.
4. Click on any skill in the list to preview its `SKILL.md` content in the right panel.
5. Click **Install** (in the list or the preview header) to install it with one click.

Installed skills appear with an **Installed** badge and are immediately available on the **Installed** tab.

## Installation Sources

Skills can be installed in four ways:

| Method | How |
|--------|-----|
| Community discovery | Use the **Discover** tab in the web dashboard |
| Git repository | Click **From Git** on the **Installed** tab and paste a git URL |
| Direct creation | Click **Create New** on the **Installed** tab and write the content |
| Manual | Copy a skill folder containing `SKILL.md` into `~/.io/skills/` |

### From a Git repository

Click **From Git** in the Skills page and paste a repository URL:

- `https://github.com/user/skill-name.git`
- `git@github.com:user/skill-name.git`

The repository must contain a `SKILL.md` file at its root.

### Created directly in the web UI

Click **Create New** in the Skills page. Enter a title (the slug is derived automatically) and write the `SKILL.md` content in the textarea. Click **Create** to save the skill to `~/.io/skills/<slug>/SKILL.md`.

## Skill Metadata

- The first `# Heading` in `SKILL.md` becomes the skill name
- The first paragraph becomes the description
- The directory name becomes the slug
