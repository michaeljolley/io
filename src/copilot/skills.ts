import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, basename, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PATHS } from "../paths.js";

const execFileAsync = promisify(execFile);

export interface SkillInfo {
  name: string;
  slug: string;
  description: string;
  path: string;
}

export async function listSkills(): Promise<SkillInfo[]> {
  if (!existsSync(PATHS.skills)) return [];

  const entries = readdirSync(PATHS.skills, { withFileTypes: true });
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = join(PATHS.skills, entry.name, "SKILL.md");
    if (!existsSync(skillMd)) continue;

    const content = readFileSync(skillMd, "utf-8");
    const firstLine = content.split("\n").find((l) => l.startsWith("# "));
    const name = firstLine?.replace(/^#\s+/, "") ?? entry.name;
    const descLine = content
      .split("\n")
      .find((l) => l.trim() && !l.startsWith("#"));
    const description = descLine?.trim() ?? "";

    skills.push({
      name,
      slug: entry.name,
      description,
      path: join(PATHS.skills, entry.name),
    });
  }

  return skills;
}

export async function addSkill(url: string): Promise<void> {
  const slug = basename(url, ".git").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const dest = join(PATHS.skills, slug);

  if (existsSync(dest)) {
    throw new Error(`Skill "${slug}" is already installed.`);
  }

  await execFileAsync("git", ["clone", "--depth", "1", "--", url, dest]);

  // Verify SKILL.md exists
  if (!existsSync(join(dest, "SKILL.md"))) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error("Repository does not contain a SKILL.md file.");
  }
}

export async function removeSkill(slug: string): Promise<void> {
  const dest = join(PATHS.skills, slug);
  if (!existsSync(dest)) {
    throw new Error(`Skill "${slug}" not found.`);
  }
  rmSync(dest, { recursive: true, force: true });
}

export async function getSkillContent(slug: string): Promise<string> {
  const skillMd = join(PATHS.skills, slug, "SKILL.md");
  if (!existsSync(skillMd)) {
    throw new Error(`Skill "${slug}" not found.`);
  }
  return readFileSync(skillMd, "utf-8");
}

export async function updateSkillContent(slug: string, content: string): Promise<void> {
  const skillMd = join(PATHS.skills, slug, "SKILL.md");
  if (!existsSync(join(PATHS.skills, slug))) {
    throw new Error(`Skill "${slug}" not found.`);
  }
  writeFileSync(skillMd, content);
}

export async function createSkill(slug: string, content: string): Promise<void> {
  const cleanSlug = slug
    .trim()
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleanSlug) {
    throw new Error("Skill title must contain at least one alphanumeric character.");
  }

  // Guard against path traversal: the resolved destination must be a direct
  // child of the skills directory (not above or beside it).
  const skillsRoot = resolve(PATHS.skills);
  const dest = resolve(skillsRoot, cleanSlug);
  if (!dest.startsWith(skillsRoot + sep)) {
    throw new Error("Invalid skill slug.");
  }

  if (existsSync(dest)) {
    throw new Error(`Skill "${cleanSlug}" already exists.`);
  }
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "SKILL.md"), content);
}

export async function loadSkillDirectories(): Promise<string[]> {
  if (!existsSync(PATHS.skills)) return [];

  const entries = readdirSync(PATHS.skills, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(PATHS.skills, e.name, "SKILL.md")))
    .map((e) => join(PATHS.skills, e.name));
}

// ---- Community skill discovery ----

export type DiscoverySource = "awesome-copilot" | "skillssh";

export interface DiscoveredSkill {
  slug: string;
  name: string;
  description: string;
  source: DiscoverySource;
  /** GitHub repo path (e.g., "clerk/skills") for skillssh sources */
  sourceRepo?: string;
  /** Install count from skills.sh */
  installs?: number;
}

interface DiscoveryCache {
  skills: DiscoveredSkill[];
  fetchedAt: number;
}

const DISCOVERY_CACHE = new Map<DiscoverySource, DiscoveryCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Validate and return a safe slug, throwing if it contains unsafe characters. */
function validateSlug(slug: string): string {
  if (!slug || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(slug)) {
    throw new Error("Invalid skill slug: must contain only letters, digits, and hyphens.");
  }
  return slug;
}

function parseAwesomeCopilotTable(markdown: string): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    // First cell contains [slug](../skills/slug/SKILL.md)
    const slugMatch = cells[0].match(/^\[([^\]]+)\]/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    if (slug === "Name") continue; // header row

    // Second cell is the description (may contain <br /> markup)
    const description = cells[1]
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim();
    if (!description || description === "Description") continue;

    skills.push({ slug, name: slug, description, source: "awesome-copilot" });
  }
  return skills;
}

async function fetchAwesomeCopilotSkills(): Promise<DiscoveredSkill[]> {
  const url =
    "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md";
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Failed to fetch awesome-copilot skills list: HTTP ${res.status}`);
  const text = await res.text();
  return parseAwesomeCopilotTable(text);
}

interface SkillsShSearchResult {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

interface SkillsShSearchResponse {
  skills: SkillsShSearchResult[];
  count: number;
}

async function fetchSkillsShSkills(query?: string): Promise<DiscoveredSkill[]> {
  try {
    const searchQuery = query?.trim() || "";
    const url = `https://skills.sh/api/search?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SkillsShSearchResponse;
    return data.skills.map((item) => ({
      slug: item.skillId || item.name || "",
      name: item.name || item.skillId || "",
      description: "",
      source: "skillssh" as const,
      sourceRepo: item.source,
      installs: item.installs,
    }));
  } catch {
    return [];
  }
}

export async function discoverSkills(
  source: DiscoverySource,
  query?: string
): Promise<DiscoveredSkill[]> {
  // For skills.sh, use the search API directly with the query
  if (source === "skillssh") {
    return fetchSkillsShSkills(query);
  }

  // For awesome-copilot, use caching and client-side filtering
  const cached = DISCOVERY_CACHE.get(source);
  let skills: DiscoveredSkill[];

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    skills = cached.skills;
  } else {
    skills = await fetchAwesomeCopilotSkills();
    DISCOVERY_CACHE.set(source, { skills, fetchedAt: Date.now() });
  }

  if (query) {
    const q = query.toLowerCase();
    skills = skills.filter(
      (s) => s.slug.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  return skills;
}

/**
 * Find the path to SKILL.md in a GitHub repo by searching the repo tree.
 * Returns the full path (e.g., "skills/features/clerk-testing/SKILL.md").
 */
async function findSkillPathInRepo(
  repoPath: string,
  skillId: string
): Promise<string> {
  const treeUrl = `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`;
  const res = await fetch(treeUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch repo tree for "${repoPath}": HTTP ${res.status}`);
  }

  interface TreeItem {
    path: string;
    type: string;
  }
  const data = (await res.json()) as { tree: TreeItem[] };

  // Look for a SKILL.md file in a folder named after the skillId
  const targetSuffix = `${skillId}/SKILL.md`;
  const match = data.tree.find(
    (item) => item.type === "blob" && item.path.endsWith(targetSuffix)
  );

  if (!match) {
    throw new Error(`Could not find SKILL.md for "${skillId}" in repo "${repoPath}"`);
  }

  return match.path;
}

function remoteSkillMdUrl(source: DiscoverySource, safeSlug: string): string {
  const encodedSlug = encodeURIComponent(safeSlug);
  if (source === "awesome-copilot") {
    return `https://raw.githubusercontent.com/github/awesome-copilot/main/skills/${encodedSlug}/SKILL.md`;
  }
  // Legacy fallback for skillssh without sourceRepo (shouldn't be used anymore)
  return `https://skills.sh/skills/${encodedSlug}/SKILL.md`;
}

export async function fetchRemoteSkillPreview(
  source: DiscoverySource,
  slug: string,
  sourceRepo?: string
): Promise<string> {
  const safeSlug = validateSlug(slug);

  // For skillssh with a sourceRepo, use GitHub directly
  if (source === "skillssh" && sourceRepo) {
    const skillPath = await findSkillPathInRepo(sourceRepo, safeSlug);
    const rawUrl = `https://raw.githubusercontent.com/${sourceRepo}/main/${skillPath}`;
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch preview for "${safeSlug}": HTTP ${res.status}`);
    }
    return res.text();
  }

  // Fallback to legacy URL approach
  const url = remoteSkillMdUrl(source, safeSlug);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Failed to fetch preview for "${safeSlug}": HTTP ${res.status}`);
  return res.text();
}

export async function installFromSource(
  source: DiscoverySource,
  slug: string,
  sourceRepo?: string
): Promise<void> {
  const safeSlug = validateSlug(slug);
  const dest = join(PATHS.skills, safeSlug);
  if (existsSync(dest)) {
    throw new Error(`Skill "${safeSlug}" is already installed.`);
  }
  const content = await fetchRemoteSkillPreview(source, safeSlug, sourceRepo);
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "SKILL.md"), content);
}
