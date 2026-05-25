import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMcpTools } from "./registry.js";
import type { McpConnectionManager, McpTool } from "./client.js";
import type { McpConfig, McpServerConfig } from "./config.js";

// Mock connection manager that returns predefined tools
function createMockManager(toolsMap: Record<string, McpTool[]>): McpConnectionManager {
  return {
    listTools: async (config: McpServerConfig) => {
      return toolsMap[config.name] ?? [];
    },
    callTool: async (_config: McpServerConfig, toolName: string, args: Record<string, unknown>) => {
      return `Called ${toolName} with ${JSON.stringify(args)}`;
    },
    getClient: async () => { throw new Error("not needed"); },
    disconnect: async () => {},
    disconnectAll: async () => {},
    isConnected: () => false,
  } as unknown as McpConnectionManager;
}

describe("MCP registry", () => {
  it("creates namespaced tools from MCP server tools", async () => {
    const manager = createMockManager({
      figma: [
        { name: "get_file", description: "Get a Figma file", inputSchema: { type: "object", properties: { file_key: { type: "string", description: "Figma file key" } }, required: ["file_key"] } },
        { name: "list_projects", description: "List projects" },
      ],
    });

    const config: McpConfig = {
      servers: [{ name: "figma", command: "npx", args: ["-y", "@anthropic/mcp-figma"], enabled: true }],
    };

    const entries = await createMcpTools(manager, config);

    assert.equal(entries.length, 2);
    assert.equal(entries[0].tool.name, "mcp_figma_get_file");
    assert.equal(entries[1].tool.name, "mcp_figma_list_projects");
    assert.equal(entries[0].serverName, "figma");
    assert.equal(entries[0].mcpToolName, "get_file");
  });

  it("skips disabled servers", async () => {
    const manager = createMockManager({
      figma: [{ name: "get_file", description: "Get file" }],
      postgres: [{ name: "query", description: "Run query" }],
    });

    const config: McpConfig = {
      servers: [
        { name: "figma", command: "npx", enabled: true },
        { name: "postgres", command: "pg-mcp", enabled: false },
      ],
    };

    const entries = await createMcpTools(manager, config);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].serverName, "figma");
  });

  it("sanitizes tool names to valid identifiers", async () => {
    const manager = createMockManager({
      "my-server": [{ name: "get-data.v2", description: "Get data" }],
    });

    const config: McpConfig = {
      servers: [{ name: "my-server", command: "cmd", enabled: true }],
    };

    const entries = await createMcpTools(manager, config);

    assert.equal(entries[0].tool.name, "mcp_my_server_get_data_v2");
  });

  it("handles server connection failure gracefully", async () => {
    const manager = {
      listTools: async () => { throw new Error("Connection refused"); },
      callTool: async () => { throw new Error("not connected"); },
      getClient: async () => { throw new Error("not connected"); },
      disconnect: async () => {},
      disconnectAll: async () => {},
      isConnected: () => false,
    } as unknown as McpConnectionManager;

    const config: McpConfig = {
      servers: [{ name: "broken", command: "bad-cmd", enabled: true }],
    };

    // Should not throw — just returns empty
    const entries = await createMcpTools(manager, config);
    assert.equal(entries.length, 0);
  });
});
