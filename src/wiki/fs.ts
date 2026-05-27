import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { PATHS } from "../paths.js";

export async function readPage(path: string): Promise<string> {
  const fullPath = join(PATHS.wikiPages, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Wiki page not found: ${path}`);
  }
  return readFileSync(fullPath, "utf-8");
}

export async function writePage(path: string, content: string): Promise<void> {
  const fullPath = join(PATHS.wikiPages, path);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
}

export async function deletePage(path: string): Promise<void> {
  const fullPath = join(PATHS.wikiPages, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Wiki page not found: ${path}`);
  }
  rmSync(fullPath);
}

export async function listPages(dir?: string): Promise<string[]> {
  const root = dir ? join(PATHS.wikiPages, dir) : PATHS.wikiPages;
  if (!existsSync(root)) return [];

  const results: string[] = [];
  const walk = (current: string, prefix: string) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(current, entry.name), rel);
      } else if (entry.name.endsWith(".md")) {
        results.push(rel);
      }
    }
  };
  walk(root, "");
  return results;
}
