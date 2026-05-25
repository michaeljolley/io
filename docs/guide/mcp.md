# MCP Servers

IO supports [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers. MCP is an open standard that lets external tools and services expose capabilities to AI models via a common protocol. By connecting MCP servers to IO, you can give the orchestrator access to additional tools — database clients, design tools, code search, and more — without modifying IO itself.

## How It Works

1. You configure one or more MCP servers in `~/.io/mcp.json`
2. At startup, IO loads the config and stores the server definitions (no connections yet)
3. When the orchestrator first uses a tool from an MCP server, IO lazily establishes the connection
4. Tools are namespaced as `mcp_<server-name>_<tool-name>` so they never collide with built-in tools
5. If an MCP server crashes, IO automatically reconnects on the next tool use

## Configuration File

MCP servers are configured in `~/.io/mcp.json` (separate from `config.json`):

```jsonc
{
  "servers": [
    {
      "name": "figma",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-figma"],
      "env": { "FIGMA_TOKEN": "your-token-here" },
      "enabled": true
    },
    {
      "name": "postgres",
      "url": "http://localhost:3001/sse",
      "enabled": true
    }
  ]
}
```

### Server Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | **Required.** Unique identifier. Used to namespace tools as `mcp_<name>_<tool>`. |
| `command` | `string` | Executable to run (stdio transport). Required if `url` is not set. |
| `args` | `string[]` | Arguments passed to `command`. |
| `url` | `string` | HTTP endpoint for SSE transport. Required if `command` is not set. |
| `env` | `object` | Environment variables passed to the subprocess (stdio only). |
| `enabled` | `boolean` | Defaults to `true`. Set to `false` to disable without removing. |

## Transports

### stdio

The server runs as a local subprocess. IO spawns it on first use and communicates over stdin/stdout.

```jsonc
{ "name": "github", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "ghp_..." } }
```

### SSE (Server-Sent Events)

The server runs independently and IO connects to it via HTTP. Useful for persistent or shared servers.

```jsonc
{ "name": "postgres", "url": "http://localhost:5432/mcp/sse" }
```

## Managing via Web UI

The `/mcp` route in the web dashboard provides a visual interface for managing servers:

- **Server list** — shows all configured servers with transport type and enabled/disabled status
- **Enable / Disable** — toggle a server without removing it
- **Delete** — remove a server from the config
- **Add Server** — form to add a new stdio or SSE server with optional env vars
- **Reload Tools** — apply config changes without restarting IO

Config changes made via the UI take effect after clicking **Reload Tools** (or restarting IO).

## Managing via Tools

The orchestrator exposes five MCP management tools:

| Tool | What it does |
| --- | --- |
| `mcp_server_list` | List all servers with name, transport, and enabled status |
| `mcp_server_add` | Add a new server (stdio or SSE) |
| `mcp_server_remove` | Remove a server by name |
| `mcp_server_toggle` | Enable or disable a server |
| `mcp_server_reload` | Hot-reload tools from the current config (no restart needed) |

Example — ask IO to add a server:

> "Add the GitHub MCP server using the GITHUB_TOKEN environment variable."

## Lazy Connections

IO does **not** connect to MCP servers at startup. Connections are established on first tool use. This means:

- No startup penalty if a server is configured but not used in a session
- A misconfigured server won't prevent IO from starting
- Disabled servers are never connected

## Auto-Reconnect

If an MCP server process crashes or its SSE connection drops, IO automatically reconnects the next time one of its tools is called. No manual intervention is needed.

## Tool Namespacing

Every tool exposed by an MCP server is prefixed with `mcp_<server-name>_`. For example, a server named `figma` exposing a `get_component` tool appears to the orchestrator as `mcp_figma_get_component`. This prevents name collisions between servers and with IO's built-in tools.

## Reloading After Config Changes

Config changes (adding, removing, toggling servers) are written to `mcp.json` immediately but the orchestrator's tool list is not updated until a reload. You can trigger a reload:

- **Web UI**: click the **Reload Tools** button on the `/mcp` page
- **Tool**: ask IO to run `mcp_server_reload`
- **Restart**: restart the IO daemon (`io stop && io start`)

::: info
Hot-reload via `mcp_server_reload` re-initializes the MCP client registry and rebuilds the tool list without dropping active orchestrator sessions. Tracked in [#273](https://github.com/michaeljolley/io/issues/273) for enhancements.
:::
