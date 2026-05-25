import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { McpConnectionManager } from "./client.js";
import type { McpServerConfig } from "./config.js";

describe("McpConnectionManager — auto-reconnect", () => {
  const testConfig: McpServerConfig = { name: "test-server", command: "echo", args: ["hello"] };

  it("callTool retries once on connection failure", async () => {
    const manager = new McpConnectionManager();
    let attempts = 0;

    // Inject a mock client that fails on first callTool, succeeds on second
    const mockClient = {
      callTool: async () => {
        attempts++;
        if (attempts === 1) throw new Error("connection reset");
        return { content: [{ type: "text", text: "success" }] };
      },
      listTools: async () => ({ tools: [] }),
      close: async () => {},
    };

    // Inject into connections map
    (manager as any).connections.set("test-server", mockClient);

    // Override getClient to return a fresh mock on reconnect
    const originalGetClient = manager.getClient.bind(manager);
    (manager as any).getClient = async (config: McpServerConfig) => {
      if (!(manager as any).connections.has(config.name)) {
        // Simulate reconnect — put a working mock
        const freshMock = {
          callTool: async () => ({ content: [{ type: "text", text: "reconnected" }] }),
          close: async () => {},
        };
        (manager as any).connections.set(config.name, freshMock);
        return freshMock;
      }
      return (manager as any).connections.get(config.name);
    };

    const result = await manager.callTool(testConfig, "test_tool", {});
    assert.equal(result, "reconnected");
  });

  it("callTool throws after retry also fails", async () => {
    const manager = new McpConnectionManager();

    const failingClient = {
      callTool: async () => { throw new Error("permanently broken"); },
      close: async () => {},
    };

    (manager as any).connections.set("test-server", failingClient);

    // Override getClient to always return a broken client
    (manager as any).getClient = async () => failingClient;

    await assert.rejects(
      () => manager.callTool(testConfig, "test_tool", {}),
      (err: Error) => {
        assert.ok(err.message.includes("failed after reconnect"));
        return true;
      },
    );
  });

  it("listTools retries once on connection failure", async () => {
    const manager = new McpConnectionManager();
    let attempts = 0;

    const mockClient = {
      listTools: async () => {
        attempts++;
        if (attempts === 1) throw new Error("connection lost");
        return { tools: [{ name: "tool1", description: "A tool", inputSchema: {} }] };
      },
      close: async () => {},
    };

    (manager as any).connections.set("test-server", mockClient);

    (manager as any).getClient = async (config: McpServerConfig) => {
      if (!(manager as any).connections.has(config.name)) {
        const freshMock = {
          listTools: async () => ({ tools: [{ name: "tool1", description: "A tool", inputSchema: {} }] }),
          close: async () => {},
        };
        (manager as any).connections.set(config.name, freshMock);
        return freshMock;
      }
      return (manager as any).connections.get(config.name);
    };

    const tools = await manager.listTools(testConfig);
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "tool1");
  });

  it("clears dead connection from map on failure", async () => {
    const manager = new McpConnectionManager();

    const deadClient = {
      callTool: async () => { throw new Error("dead"); },
      close: async () => {},
    };

    (manager as any).connections.set("test-server", deadClient);
    assert.ok(manager.isConnected("test-server"));

    // Override getClient to simulate a reconnect failure too
    (manager as any).getClient = async () => { throw new Error("cannot reconnect"); };

    try {
      await manager.callTool(testConfig, "test_tool", {});
    } catch { /* expected */ }

    // Dead connection should have been cleared
    assert.ok(!manager.isConnected("test-server"));
  });
});
