import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { IO_HOME } from "../paths.js";
import { join } from "path";

export const MCP_CONFIG_PATH = join(IO_HOME, "mcp.json");

// Mutable override for tests — mirrors the setDbPathForTests pattern.
let _configPath = MCP_CONFIG_PATH;

export function setMcpConfigPathForTests(path: string): void {
  _configPath = path;
}

export function resetMcpConfigPath(): void {
  _configPath = MCP_CONFIG_PATH;
}

export interface McpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

export interface McpConfig {
  servers: McpServerConfig[];
}

export function loadMcpConfig(): McpConfig {
  if (!existsSync(_configPath)) {
    return { servers: [] };
  }
  try {
    const raw = readFileSync(_configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.servers || !Array.isArray(parsed.servers)) {
      return { servers: [] };
    }
    return parsed as McpConfig;
  } catch {
    return { servers: [] };
  }
}

export function saveMcpConfig(config: McpConfig): void {
  const dir = dirname(_configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(_configPath, JSON.stringify(config, null, 2), "utf-8");
}
