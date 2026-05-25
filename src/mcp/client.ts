import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServerConfig } from "./config.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpConnectionManager {
  private connections = new Map<string, Client>();
  private connecting = new Map<string, Promise<Client>>();

  async getClient(config: McpServerConfig): Promise<Client> {
    const existing = this.connections.get(config.name);
    if (existing) return existing;

    // Deduplicate concurrent connection attempts
    const pending = this.connecting.get(config.name);
    if (pending) return pending;

    const promise = this.connect(config);
    this.connecting.set(config.name, promise);
    try {
      const client = await promise;
      this.connections.set(config.name, client);
      return client;
    } finally {
      this.connecting.delete(config.name);
    }
  }

  private async connect(config: McpServerConfig): Promise<Client> {
    const client = new Client(
      { name: "io-assistant", version: "1.0.0" },
      { capabilities: {} },
    );

    let transport;
    if (config.url) {
      transport = new SSEClientTransport(new URL(config.url));
    } else if (config.command) {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else {
      throw new Error(`MCP server "${config.name}" has no command or url configured`);
    }

    await client.connect(transport);
    return client;
  }

  async listTools(config: McpServerConfig): Promise<McpTool[]> {
    const execute = async () => {
      const client = await this.getClient(config);
      const result = await client.listTools();
      return (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown> | undefined,
      }));
    };

    try {
      return await execute();
    } catch (err) {
      console.error(`[mcp] listTools failed for ${config.name}, attempting reconnect:`, err instanceof Error ? err.message : err);
      this.connections.delete(config.name);
      return await execute();
    }
  }

  async callTool(config: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const execute = async () => {
      const client = await this.getClient(config);
      const result = await client.callTool({ name: toolName, arguments: args });
      // MCP returns content as an array of content blocks
      if (result.content && Array.isArray(result.content)) {
        return result.content
          .map((block: { type?: string; text?: string }) =>
            block.type === "text" ? block.text : JSON.stringify(block),
          )
          .join("\n");
      }
      return result.content ?? result;
    };

    try {
      return await execute();
    } catch (err) {
      // Connection likely dead — clear and retry once
      console.error(`[mcp] Tool call failed for ${config.name}/${toolName}, attempting reconnect:`, err instanceof Error ? err.message : err);
      this.connections.delete(config.name);
      try {
        return await execute();
      } catch (retryErr) {
        throw new Error(`MCP tool ${config.name}/${toolName} failed after reconnect: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
      }
    }
  }

  async disconnect(name: string): Promise<void> {
    const client = this.connections.get(name);
    if (client) {
      try {
        await client.close();
      } catch { /* ignore */ }
      this.connections.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    const names = [...this.connections.keys()];
    await Promise.allSettled(names.map((n) => this.disconnect(n)));
  }

  isConnected(name: string): boolean {
    return this.connections.has(name);
  }
}
