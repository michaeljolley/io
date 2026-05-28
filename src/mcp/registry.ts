import { loadMcpConfig, type McpServerConfig } from "./config.js";
import type { MCPServerConfig } from "@github/copilot-sdk";

// Module-level array of MCP tools loaded at startup
let loadedServers: McpServerConfig[] = [];

export function initMcpRegistry(): void {
  loadedServers = loadMcpConfig().filter((s) => s.enabled);
}

export function getMcpServersForSession(): Record<string, MCPServerConfig> | undefined {
  if (loadedServers.length === 0) return undefined;

  const result: Record<string, MCPServerConfig> = {};
  for (const server of loadedServers) {
    if (server.type === "stdio" && server.command) {
      result[server.name] = {
        type: "local",
        command: server.command,
        args: server.args ?? [],
        env: server.env,
        tools: ["*"],
      } as any;
    } else if (server.type === "http" && server.url) {
      result[server.name] = {
        type: "http",
        url: server.url,
        headers: server.headers,
      } as any;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function listServers(): McpServerConfig[] {
  return loadMcpConfig();
}

export function addServerToRegistry(server: McpServerConfig): void {
  if (server.enabled) {
    loadedServers.push(server);
  }
}

export function removeServerFromRegistry(id: string): void {
  loadedServers = loadedServers.filter((s) => s.id !== id);
}
