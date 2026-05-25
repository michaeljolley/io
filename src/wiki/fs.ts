import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
} from "fs";
import { join, resolve, relative, dirname, basename, extname } from "path";
import { randomBytes } from "crypto";
import { WIKI_DIR } from "../paths.js";

export const PAGES_DIR = join(WIKI_DIR, "pages");
export const SOURCES_DIR = join(WIKI_DIR, "sources");

const INDEX_PATH = join(WIKI_DIR, "index.md");
const LOG_PATH = join(WIKI_DIR, "log.md");

const PAGE_CATEGORIES = ["preferences", "projects", "people", "general"];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolvePath(relativePath: string): string {
  const full = resolve(WIKI_DIR, relativePath);
  const rel = relative(WIKI_DIR, full);
  if (rel.startsWith("..") || resolve(full) !== full) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }
  return full;
}

function walkDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function writeFileAtomic(fullPath: string, content: string): void {
  const dir = dirname(fullPath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, content, "utf-8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, fullPath);
}

export function assertPagePath(relativePath: string): void {
  if (!relativePath.startsWith("pages/") && !relativePath.startsWith("pages\\")) {
    throw new Error(`Page path must be under pages/: ${relativePath}`);
  }
  if (extname(relativePath) !== ".md") {
    throw new Error(`Page path must end in .md: ${relativePath}`);
  }
  const full = resolve(WIKI_DIR, relativePath);
  const rel = relative(WIKI_DIR, full);
  if (rel.startsWith("..") || !rel.startsWith("pages")) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }
}

export function ensureWikiStructure(): boolean {
  const created = !existsSync(WIKI_DIR);
  mkdirSync(WIKI_DIR, { recursive: true });
  mkdirSync(PAGES_DIR, { recursive: true });
  mkdirSync(SOURCES_DIR, { recursive: true });

  for (const cat of PAGE_CATEGORIES) {
    mkdirSync(join(PAGES_DIR, cat), { recursive: true });
  }

  if (!existsSync(INDEX_PATH)) {
    writeFileAtomic(INDEX_PATH, "# Wiki Index\n\n_No pages yet._\n");
  }
  if (!existsSync(LOG_PATH)) {
    writeFileAtomic(LOG_PATH, "# Wiki Log\n\n_No operations recorded._\n");
  }

  return created;
}

export function readPage(relativePath: string): string | undefined {
  const full = resolvePath(relativePath);
  if (!existsSync(full)) return undefined;
  return readFileSync(full, "utf-8");
}

export function writePage(relativePath: string, content: string): void {
  assertPagePath(relativePath);
  const full = resolvePath(relativePath);
  writeFileAtomic(full, content);
}

export function deletePage(relativePath: string): boolean {
  assertPagePath(relativePath);
  const full = resolvePath(relativePath);
  if (!existsSync(full)) return false;
  unlinkSync(full);
  return true;
}

export function pageExists(relativePath: string): boolean {
  assertPagePath(relativePath);
  const full = resolvePath(relativePath);
  return existsSync(full);
}

export function listPages(): string[] {
  return walkDir(PAGES_DIR)
    .filter((f) => extname(f) === ".md")
    .map((f) => relative(WIKI_DIR, f).replace(/\\/g, "/"));
}

export function writeRawSource(name: string, content: string): void {
  const sanitized = basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!sanitized) throw new Error(`Invalid source name: ${name}`);
  const full = join(SOURCES_DIR, sanitized);
  writeFileAtomic(full, content);
}

export function readRawSource(name: string): string | undefined {
  const sanitized = basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const full = join(SOURCES_DIR, sanitized);
  if (!existsSync(full)) return undefined;
  return readFileSync(full, "utf-8");
}

export function listSources(): string[] {
  if (!existsSync(SOURCES_DIR)) return [];
  return readdirSync(SOURCES_DIR).filter((f) => {
    const full = join(SOURCES_DIR, f);
    return statSync(full).isFile();
  });
}

export function readIndexFile(): string {
  if (!existsSync(INDEX_PATH)) return "";
  return readFileSync(INDEX_PATH, "utf-8");
}

export function writeIndexFile(content: string): void {
  writeFileAtomic(INDEX_PATH, content);
}

export function readLogFile(): string {
  if (!existsSync(LOG_PATH)) return "";
  return readFileSync(LOG_PATH, "utf-8");
}

export function writeLogFile(content: string): void {
  writeFileAtomic(LOG_PATH, content);
}

export function getWikiDir(): string {
  return WIKI_DIR;
}

/**
 * Read all wiki pages for a squad by slug.
 * Returns array of { path, content } for pages under pages/squads/{slug}/.
 */
export function readSquadWikiPages(slug: string): Array<{ path: string; content: string }> {
  const prefix = `pages/squads/${slug}/`;
  return listPages()
    .filter(p => p.startsWith(prefix))
    .map(p => ({ path: p, content: readPage(p) ?? "" }))
    .filter(entry => entry.content.length > 0);
}
