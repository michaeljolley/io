# CLI Commands

## `io --daemon`

Start IO as a background daemon. This is the default command.

```bash
io --daemon
```

**Options:**
| Flag | Description |
| --- | --- |
| `--self-edit` | Allow IO to modify its own source code |

## `io setup`

Run the interactive setup wizard to configure IO.

```bash
io setup
```

Prompts for Supabase credentials, Telegram bot token, and user ID. Saves to `~/.io/config.json`.

## `io skill list`

List all installed skills.

```bash
io skill list
```

## `io skill add <url>`

Install a skill from a git repository.

```bash
io skill add https://github.com/user/my-skill.git
```

The repository must contain a `SKILL.md` file at its root.

## `io skill remove <slug>`

Remove an installed skill by its slug (directory name).

```bash
io skill remove my-skill
```
