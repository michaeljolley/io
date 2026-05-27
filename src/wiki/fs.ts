import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { readdirSync } from "node:fs";
import { PATHS } from "../paths.js";

function safeJoin(base: string, userPath: string): string {
  // Strip path traversal by removing any '..' and absolute path components
  const sanitized = userPath
    .split(/[/\\]/)
    .filter((segment) => segment !== ".." && segment !== ".")
    .join("/");
  const resolved = join(base, sanitized);
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid path: traversal outside base directory is not allowed");
  }
  return resolved;
}

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

export async function listTemplates(): Promise<string[]> {
  const root = PATHS.wikiSquadTemplates;
  if (!existsSync(root)) return [];

  const results: string[] = [];
  const walk = (current: string, prefix: string) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(current, entry.name), rel);
      } else {
        results.push(rel);
      }
    }
  };
  walk(root, "");
  return results;
}

export async function readTemplate(path: string): Promise<string> {
  const fullPath = safeJoin(PATHS.wikiSquadTemplates, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Template not found: ${path}`);
  }
  return readFileSync(fullPath, "utf-8");
}

export async function writeTemplate(path: string, content: string): Promise<void> {
  const fullPath = safeJoin(PATHS.wikiSquadTemplates, path);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
}

export async function deleteTemplate(path: string): Promise<void> {
  const fullPath = safeJoin(PATHS.wikiSquadTemplates, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Template not found: ${path}`);
  }
  rmSync(fullPath);
}

export async function copySquadTemplates(slug: string): Promise<void> {
  const templateDir = PATHS.wikiSquadTemplates;
  if (!existsSync(templateDir)) return;

  const destDir = join(PATHS.wikiPages, "squads", slug);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  cpSync(templateDir, destDir, { recursive: true, force: false, errorOnExist: false });
}
