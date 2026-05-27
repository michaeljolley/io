import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PATHS } from "../paths.js";

const execAsync = promisify(exec);

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

  await execAsync(`git clone --depth 1 ${url} ${dest}`);

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
  if (!dest.startsWith(skillsRoot + "/")) {
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
