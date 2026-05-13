import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";
import { SKILLS_DIR } from "../paths.js";

export interface SkillInfo {
  name: string;
  slug: string;
  description: string;
  path: string;
}

export interface SkillRegistryResult {
  name: string;
  description: string;
  repoUrl: string;
}

/**
 * Scan SKILLS_DIR for subdirectories that contain a SKILL.md file.
 * Returns absolute paths to qualifying skill directories.
 */
export function getSkillDirectories(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const dirs: string[] = [];

  for (const entry of readdirSync(SKILLS_DIR)) {
    const skillDir = join(SKILLS_DIR, entry);
    if (!statSync(skillDir).isDirectory()) continue;

    const skillMd = join(skillDir, "SKILL.md");
    if (!existsSync(skillMd)) continue;

    dirs.push(skillDir);

    // Check for an agents subdirectory (Copilot SDK custom agents)
    const agentsDir = join(skillDir, "agents");
    if (existsSync(agentsDir) && statSync(agentsDir).isDirectory()) {
      dirs.push(agentsDir);
    }
  }

  return dirs;
}

function parseSkillMd(content: string): { name: string; description: string } {
  const lines = content.split(/\r?\n/);

  let name = "";
  let description = "";
  let foundHeading = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (!foundHeading) {
      const match = line.match(/^#\s+(.+)/);
      if (match) {
        name = match[1].trim();
        foundHeading = true;
      }
      continue;
    }

    // Skip blank lines between heading and first paragraph
    if (descLines.length === 0 && line.trim() === "") continue;

    // Stop at the next blank line after collecting description text
    if (descLines.length > 0 && line.trim() === "") break;

    // Stop at another heading
    if (line.match(/^#+\s/)) break;

    descLines.push(line.trim());
  }

  description = descLines.join(" ");
  return { name, description };
}

/**
 * List all installed skills with metadata parsed from their SKILL.md files.
 */
export function listSkills(): SkillInfo[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const skills: SkillInfo[] = [];

  for (const entry of readdirSync(SKILLS_DIR)) {
    const skillDir = join(SKILLS_DIR, entry);
    if (!statSync(skillDir).isDirectory()) continue;

    const skillMdPath = join(skillDir, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const content = readFileSync(skillMdPath, "utf-8");
    const { name, description } = parseSkillMd(content);

    skills.push({
      name: name || entry,
      slug: entry,
      description,
      path: skillDir,
    });
  }

  return skills;
}

export type ParsedSkillUrl =
  | { type: "repo"; url: string }
  | { type: "file"; rawUrl: string; slug: string };

const GITHUB_BLOB_RE =
  /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+\/)?SKILL\.md$/i;
const RAW_GH_RE =
  /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+\/)?SKILL\.md$/i;
const GENERIC_SKILL_MD_RE = /\/SKILL\.md$/i;

function deriveSlug(repo: string, pathPrefix: string | undefined): string {
  if (!pathPrefix) return repo;
  const segments = pathPrefix.replace(/\/$/, "").split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? `${repo}-${last}` : repo;
}

/**
 * Determine whether the input URL points to a full repo or a specific
 * SKILL.md file. For GitHub blob URLs the raw download URL is derived
 * automatically.
 */
export function parseSkillUrl(input: string): ParsedSkillUrl {
  const blobMatch = input.match(GITHUB_BLOB_RE);
  if (blobMatch) {
    const [, owner, repo, branch, pathPrefix] = blobMatch;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathPrefix ?? ""}SKILL.md`;
    return { type: "file", rawUrl, slug: deriveSlug(repo, pathPrefix) };
  }

  const rawMatch = input.match(RAW_GH_RE);
  if (rawMatch) {
    const [, _owner, repo, _branch, pathPrefix] = rawMatch;
    return { type: "file", rawUrl: input, slug: deriveSlug(repo, pathPrefix) };
  }

  if (GENERIC_SKILL_MD_RE.test(input)) {
    if (!input.startsWith("https://")) {
      throw new Error("Only https:// URLs are supported for SKILL.md installs.");
    }
    const urlObj = new URL(input);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    // Use the segment before SKILL.md, or the hostname as slug fallback
    const slug = segments.length >= 2
      ? segments[segments.length - 2]
      : urlObj.hostname.replace(/\./g, "-");
    return { type: "file", rawUrl: input, slug };
  }

  return { type: "repo", url: input };
}

async function installSkillFromFile(rawUrl: string, slug: string): Promise<SkillInfo> {
  if (!rawUrl.startsWith("https://")) {
    throw new Error("Only https:// URLs are supported for SKILL.md installs.");
  }

  const destDir = join(SKILLS_DIR, slug);
  if (existsSync(destDir)) {
    throw new Error(`Skill "${slug}" is already installed.`);
  }

  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch SKILL.md from ${rawUrl} (HTTP ${response.status})`);
  }

  const content = await response.text();

  // Validate: at least one markdown heading in the first 10 lines
  const first10 = content.split(/\r?\n/).slice(0, 10);
  if (!first10.some((line) => /^#\s+/.test(line))) {
    throw new Error("URL does not appear to contain a valid SKILL.md file.");
  }

  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "SKILL.md"), content, "utf-8");

  const { name, description } = parseSkillMd(content);
  return {
    name: name || slug,
    slug,
    description,
    path: destDir,
  };
}

/**
 * Install a skill from a git repo URL or a direct SKILL.md file URL.
 * Throws if the repo/file does not contain a valid SKILL.md.
 */
export async function installSkill(input: string): Promise<SkillInfo> {
  const parsed = parseSkillUrl(input);

  if (parsed.type === "file") {
    return installSkillFromFile(parsed.rawUrl, parsed.slug);
  }

  const repoUrl = parsed.url;
  const repoName = basename(repoUrl, ".git").replace(/\.git$/, "");
  const destDir = join(SKILLS_DIR, repoName);

  execSync(`git clone ${repoUrl} ${destDir}`, { stdio: "pipe" });

  const skillMdPath = join(destDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    rmSync(destDir, { recursive: true, force: true });
    throw new Error(
      `Repository "${repoUrl}" does not contain a SKILL.md file.`,
    );
  }

  const content = readFileSync(skillMdPath, "utf-8");
  const { name, description } = parseSkillMd(content);

  return {
    name: name || repoName,
    slug: repoName,
    description,
    path: destDir,
  };
}

/**
 * Remove a skill directory by its slug. Returns true if it existed.
 */
export function removeSkill(slug: string): boolean {
  const skillDir = join(SKILLS_DIR, slug);
  if (!existsSync(skillDir)) return false;
  rmSync(skillDir, { recursive: true, force: true });
  return true;
}

/**
 * Search the skills registry for skills matching the given query.
 * Returns an empty array on network or parsing errors.
 */
export async function searchSkillsRegistry(
  query: string,
): Promise<SkillRegistryResult[]> {
  try {
    const url = `https://skills.sh/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as SkillRegistryResult[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
