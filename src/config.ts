import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { PATHS } from "./paths.js";

const ModelPriceSchema = z.object({
  inputPer1M: z.number(),
  outputPer1M: z.number(),
});

const ConfigSchema = z.object({
  telegramBotToken: z.string().optional(),
  authorizedUserId: z.number().optional(),
  telegramEnabled: z.boolean().default(false),
  selfEditEnabled: z.boolean().default(false),
  defaultModel: z.string().default("gpt-4.1"),
  port: z.number().default(3170),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  authorizedEmail: z.string().optional(),
  githubToken: z.string().optional(),
  backgroundNotifyMode: z
    .enum(["all", "meaningful", "off"])
    .default("meaningful"),
  backgroundNotifyTelegram: z.boolean().default(true),
  watchdogEnabled: z.boolean().default(true),
  modelPricing: z.record(z.string(), ModelPriceSchema).optional(),
  tokenAlertThreshold: z.number().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | undefined;
let configWarning: string | undefined;

/** Returns a warning message if config fell back to defaults on last load. */
export function getConfigWarning(): string | undefined {
  return configWarning;
}

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;

  if (!existsSync(PATHS.config)) {
    configWarning = `Config file not found at ${PATHS.config} — using defaults. Run "io setup" or create the file manually.`;
    console.warn(`[io] ⚠️  ${configWarning}`);
    const defaults = ConfigSchema.parse({});
    cachedConfig = defaults;
    return defaults;
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(PATHS.config, "utf-8"));
  } catch (err) {
    configWarning = `Config file at ${PATHS.config} is corrupted or unreadable — using defaults. Please restore your config.`;
    console.warn(`[io] ⚠️  ${configWarning}`);
    const defaults = ConfigSchema.parse({});
    cachedConfig = defaults;
    return defaults;
  }

  // Migrate old apiPort field
  if ("apiPort" in raw && !("port" in raw)) {
    raw.port = raw.apiPort;
    delete raw.apiPort;
    saveConfig(raw as any);
  }

  configWarning = undefined;
  cachedConfig = ConfigSchema.parse(raw);
  return cachedConfig;
}

export function saveConfig(config: Partial<Config>): void {
  const dir = dirname(PATHS.config);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let current: Record<string, unknown> = {};
  if (existsSync(PATHS.config)) {
    try {
      current = JSON.parse(readFileSync(PATHS.config, "utf-8"));
    } catch {
      // If file is corrupted, use cached config as baseline to avoid data loss
      if (cachedConfig) {
        current = JSON.parse(JSON.stringify(cachedConfig));
      }
    }
  } else if (cachedConfig) {
    // File doesn't exist but we have a cached config (from earlier load) — use it as baseline
    current = JSON.parse(JSON.stringify(cachedConfig));
  }

  const merged = { ...current, ...config };
  writeFileSync(PATHS.config, JSON.stringify(merged, null, 2) + "\n");
  cachedConfig = ConfigSchema.parse(merged);
}

export function resetConfigCache(): void {
  cachedConfig = undefined;
}
