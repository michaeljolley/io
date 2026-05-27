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

::: tip
Skills are managed through the web dashboard — no CLI commands needed.
:::
