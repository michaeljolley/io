import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import type { McpConnectionManager, McpTool } from "./client.js";
import type { McpConfig, McpServerConfig } from "./config.js";

/**
 * Sanitize a name for use as a tool identifier (alphanumeric + underscore only).
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Convert an MCP JSON Schema inputSchema to a Zod schema.
 * Falls back to z.object({}) for passthrough if schema is missing or unparseable.
 */
function jsonSchemaToZod(inputSchema?: Record<string, unknown>): z.ZodType {
  if (!inputSchema || !inputSchema.properties) {
    return z.object({}).passthrough();
  }

  const properties = inputSchema.properties as Record<string, { type?: string; description?: string }>;
  const required = new Set((inputSchema.required as string[]) ?? []);
  const shape: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodType;
    switch (prop.type) {
      case "string":
        field = z.string();
        break;
      case "number":
      case "integer":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "array":
        field = z.array(z.unknown());
        break;
      case "object":
        field = z.record(z.string(), z.unknown());
        break;
      default:
        field = z.unknown();
    }

    if (prop.description) {
      field = (field as z.ZodString).describe(prop.description);
    }

    if (!required.has(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape).passthrough();
}

export interface McpToolEntry {
  serverName: string;
  serverConfig: McpServerConfig;
  mcpToolName: string;
  tool: ReturnType<typeof defineTool> & { name: string };
}

/**
 * Create Copilot SDK tools from all enabled MCP servers.
 * Connects to each server, lists its tools, and wraps them.
 */
export async function createMcpTools(
  manager: McpConnectionManager,
  config: McpConfig,
): Promise<McpToolEntry[]> {
  const entries: McpToolEntry[] = [];

  const enabledServers = config.servers.filter((s) => s.enabled !== false);

  for (const serverConfig of enabledServers) {
    try {
      const tools = await manager.listTools(serverConfig);
      for (const mcpTool of tools) {
        const toolName = `mcp_${sanitizeName(serverConfig.name)}_${sanitizeName(mcpTool.name)}`;
        const description = mcpTool.description
          ? `[MCP: ${serverConfig.name}] ${mcpTool.description}`
          : `[MCP: ${serverConfig.name}] ${mcpTool.name}`;

        const parameters = jsonSchemaToZod(mcpTool.inputSchema);

        const tool = defineTool(toolName, {
          description,
          skipPermission: true,
          parameters: parameters as z.ZodObject<z.ZodRawShape>,
          handler: async (args: Record<string, unknown>) => {
            try {
              const result = await manager.callTool(serverConfig, mcpTool.name, args);
              return typeof result === "string" ? result : JSON.stringify(result);
            } catch (err) {
              return `MCP tool error (${serverConfig.name}/${mcpTool.name}): ${err instanceof Error ? err.message : String(err)}`;
            }
          },
        });

        entries.push({
          serverName: serverConfig.name,
          serverConfig,
          mcpToolName: mcpTool.name,
          tool: tool as McpToolEntry["tool"],
        });
      }
    } catch (err) {
      console.error(
        `[mcp] Failed to connect to server "${serverConfig.name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return entries;
}
