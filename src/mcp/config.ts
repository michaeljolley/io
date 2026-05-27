import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS } from "../paths.js";

export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

export function loadMcpConfig(): McpServerConfig[] {
  if (!existsSync(PATHS.mcpConfig)) return [];
  const raw = JSON.parse(readFileSync(PATHS.mcpConfig, "utf-8"));
  return Array.isArray(raw.servers) ? raw.servers : [];
}

export function saveMcpConfig(servers: McpServerConfig[]): void {
  writeFileSync(PATHS.mcpConfig, JSON.stringify({ servers }, null, 2) + "\n");
}

export function addMcpServer(server: McpServerConfig): void {
  const servers = loadMcpConfig();
  servers.push(server);
  saveMcpConfig(servers);
}

export function removeMcpServer(id: string): void {
  const servers = loadMcpConfig().filter((s) => s.id !== id);
  saveMcpConfig(servers);
}

export function toggleMcpServer(id: string, enabled: boolean): void {
  const servers = loadMcpConfig();
  const server = servers.find((s) => s.id === id);
  if (server) {
    server.enabled = enabled;
    saveMcpConfig(servers);
  }
}
