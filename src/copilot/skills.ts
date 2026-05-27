import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { PATHS } from "../paths.js";

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

  execSync(`git clone --depth 1 ${url} ${dest}`, { stdio: "pipe" });

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

export async function loadSkillDirectories(): Promise<string[]> {
  if (!existsSync(PATHS.skills)) return [];

  const entries = readdirSync(PATHS.skills, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(PATHS.skills, e.name, "SKILL.md")))
    .map((e) => join(PATHS.skills, e.name));
}
