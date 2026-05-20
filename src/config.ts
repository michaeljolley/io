import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG_PATH, IO_HOME } from "./paths.js";

export interface ModelTiers {
  high?: string[];
  medium?: string[];
  low?: string[];
}

export interface IOConfig {
  telegramBotToken?: string;
  authorizedUserId?: number;
  telegramEnabled: boolean;
  selfEditEnabled: boolean;
  defaultModel?: string;
  modelTiers?: ModelTiers;
  port: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  authorizedEmail?: string;
  /** @deprecated Use `port` instead. Kept for backward compatibility. */
  apiPort?: number;
  backgroundNotifyMode: "all" | "meaningful" | "off";
  backgroundNotifyTelegram: boolean;
  backgroundNotifyTui: boolean;
  watchdogEnabled: boolean;
}

const DEFAULT_CONFIG: IOConfig = {
  telegramEnabled: false,
  selfEditEnabled: false,
  port: 3170,
  backgroundNotifyMode: "meaningful",
  backgroundNotifyTelegram: true,
  backgroundNotifyTui: true,
  watchdogEnabled: true,
};

function loadConfig(): IOConfig {
  mkdirSync(IO_HOME, { recursive: true });

  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<IOConfig> & { apiPort?: number };
    // Migrate apiPort → port
    if (parsed.apiPort != null && parsed.port == null) {
      parsed.port = parsed.apiPort;
    }
    delete parsed.apiPort;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export const config = loadConfig();

export function saveConfig(updates: Partial<IOConfig>): void {
  Object.assign(config, updates);
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
