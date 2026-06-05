import { homedir } from "node:os";
import { join } from "node:path";

export const DATA_DIR = join(homedir(), ".io");
export const WIKI_DIR = join(DATA_DIR, "wiki");
export const SKILLS_DIR = join(DATA_DIR, "skills");
export const LOGS_DIR = join(DATA_DIR, "logs");
export const CONFIG_PATH = join(DATA_DIR, "config.json");
export const DB_PATH = join(DATA_DIR, "io.db");
export const SKILLS_LOCK_PATH = join(DATA_DIR, "skills-lock.json");
