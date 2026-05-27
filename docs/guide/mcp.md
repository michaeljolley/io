# MCP Servers

IO supports the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) for connecting to external tool servers.

## Configuration

MCP servers are configured in `~/.io/mcp.json`:

```json
{
  "servers": [
    {
      "id": "playwright",
      "name": "Playwright",
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "enabled": true
    },
    {
      "id": "my-api",
      "name": "My API Server",
      "type": "http",
      "url": "https://my-mcp-server.example.com",
      "headers": { "Authorization": "Bearer token" },
      "enabled": true
    }
  ]
}
```

## Server Types

### stdio

Spawns a local process that communicates over stdin/stdout:

| Field | Description |
| --- | --- |
| `command` | Executable to run |
| `args` | Command-line arguments |

### http

Connects to a remote MCP server over HTTP:

| Field | Description |
| --- | --- |
| `url` | Server URL |
| `headers` | Optional HTTP headers (for authentication) |

## Management

### Web Dashboard

The MCP Servers page in the web dashboard allows you to:
- View all configured servers and their status
- Enable/disable individual servers
- Add new servers
- Remove servers

### Module-Level Registry

MCP tools are loaded **once** at orchestrator startup into a module-level array. When a new server is added at runtime, its tools are appended to that array. Disabled servers are excluded from the registry.

## Squad Access

Squad agents have access to MCP tools when working on tasks. The tools are included in their ephemeral session configuration.
