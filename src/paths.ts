import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

export const IO_HOME = join(homedir(), ".io");
export const CONFIG_PATH = join(IO_HOME, "config.json");
export const DB_PATH = join(IO_HOME, "io.db");
export const WIKI_DIR = join(IO_HOME, "wiki");
export const SKILLS_DIR = join(IO_HOME, "skills");
export const SESSIONS_DIR = join(IO_HOME, "sessions");
export const LOGS_DIR = join(IO_HOME, "logs");

function resolveVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["..", join("..", "..")]) {
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, rel, "package.json"), "utf-8"));
      if (pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return "0.0.0";
}

export const IO_VERSION: string = resolveVersion();
