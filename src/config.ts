import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { PATHS } from "./paths.js";

const ConfigSchema = z.object({
  telegramBotToken: z.string().optional(),
  authorizedUserId: z.number().optional(),
  telegramEnabled: z.boolean().default(false),
  selfEditEnabled: z.boolean().default(false),
  defaultModel: z.string().default("gpt-4.1"),
  modelTiers: z
    .object({
      high: z.array(z.string()).default(["claude-opus-4.7", "claude-opus-4.6"]),
      medium: z
        .array(z.string())
        .default(["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"]),
      low: z.array(z.string()).default(["claude-haiku-4.5", "gpt-5.4-mini"]),
    })
    .default({
      high: ["claude-opus-4.7", "claude-opus-4.6"],
      medium: ["claude-sonnet-4.6", "gpt-5.5", "claude-opus-4.5"],
      low: ["claude-haiku-4.5", "gpt-5.4-mini"],
    }),
  port: z.number().default(3170),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  authorizedEmail: z.string().optional(),
  backgroundNotifyMode: z
    .enum(["all", "meaningful", "off"])
    .default("meaningful"),
  backgroundNotifyTelegram: z.boolean().default(true),
  watchdogEnabled: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | undefined;

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;

  if (!existsSync(PATHS.config)) {
    const defaults = ConfigSchema.parse({});
    cachedConfig = defaults;
    return defaults;
  }

  const raw = JSON.parse(readFileSync(PATHS.config, "utf-8"));

  // Migrate old apiPort field
  if ("apiPort" in raw && !("port" in raw)) {
    raw.port = raw.apiPort;
    delete raw.apiPort;
    saveConfig(raw);
  }

  cachedConfig = ConfigSchema.parse(raw);
  return cachedConfig;
}

export function saveConfig(config: Partial<Config>): void {
  const dir = dirname(PATHS.config);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const current = existsSync(PATHS.config)
    ? JSON.parse(readFileSync(PATHS.config, "utf-8"))
    : {};

  const merged = { ...current, ...config };
  writeFileSync(PATHS.config, JSON.stringify(merged, null, 2) + "\n");
  cachedConfig = ConfigSchema.parse(merged);
}

export function resetConfigCache(): void {
  cachedConfig = undefined;
}
