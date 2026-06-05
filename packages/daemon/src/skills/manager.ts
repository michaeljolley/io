import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import matter from "gray-matter";

import { SKILLS_DIR, SKILLS_LOCK_PATH } from "@io/shared/paths";

export interface InstalledSkill {
	id: string;
	name: string;
	url: string;
	installedAt: string;
}

interface SkillsLockFile {
	skills: InstalledSkill[];
}

export async function installSkill(url: string): Promise<InstalledSkill> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Failed to download skill from ${url}: ${response.status} ${response.statusText}`,
		);
	}

	const skillMarkdown = await response.text();
	const skillId = getSkillIdFromUrl(url);
	const skillDirectory = join(SKILLS_DIR, skillId);
	const skillPath = join(skillDirectory, "SKILL.md");
	const parsed = matter(skillMarkdown);
	const installedSkill: InstalledSkill = {
		id: skillId,
		name:
			typeof parsed.data.name === "string" && parsed.data.name.trim() !== ""
				? parsed.data.name
				: skillId,
		url,
		installedAt: new Date().toISOString(),
	};

	await mkdir(skillDirectory, { recursive: true });
	await writeFile(skillPath, skillMarkdown, "utf8");
	await upsertInstalledSkill(installedSkill);

	return installedSkill;
}

export async function installFromSource(source: string, slug: string): Promise<InstalledSkill> {
	const repoPath = source.includes("/") ? source : `anthropics/${source}`;
	const normalizedSlug = slug.replace(/^\/+|\/+$/g, "");
	const url = `https://raw.githubusercontent.com/${repoPath}/main/skills/${normalizedSlug}/SKILL.md`;

	return installSkill(url);
}

export async function removeSkill(id: string): Promise<void> {
	await rm(join(SKILLS_DIR, id), { recursive: true, force: true });

	const lockFile = await readSkillsLock();
	lockFile.skills = lockFile.skills.filter((skill) => skill.id !== id);
	await writeSkillsLock(lockFile);
}

export async function listInstalledSkills(): Promise<InstalledSkill[]> {
	const lockFile = await readSkillsLock();
	return [...lockFile.skills].sort((left, right) => left.name.localeCompare(right.name));
}

async function readSkillsLock(): Promise<SkillsLockFile> {
	try {
		const rawLockFile = await readFile(SKILLS_LOCK_PATH, "utf8");
		const parsed = JSON.parse(rawLockFile) as Partial<SkillsLockFile>;

		return {
			skills: Array.isArray(parsed.skills)
				? parsed.skills.filter(isInstalledSkillRecord).map((skill) => ({
						id: skill.id,
						name: skill.name,
						url: skill.url,
						installedAt: skill.installedAt,
					}))
				: [],
		};
	} catch (error) {
		if (isMissingFileError(error)) {
			return { skills: [] };
		}

		throw error;
	}
}

async function writeSkillsLock(lockFile: SkillsLockFile): Promise<void> {
	await mkdir(dirname(SKILLS_LOCK_PATH), { recursive: true });
	await writeFile(SKILLS_LOCK_PATH, `${JSON.stringify(lockFile, null, 2)}\n`, "utf8");
}

async function upsertInstalledSkill(skill: InstalledSkill): Promise<void> {
	const lockFile = await readSkillsLock();
	const existingIndex = lockFile.skills.findIndex(
		(installedSkill) => installedSkill.id === skill.id,
	);

	if (existingIndex >= 0) {
		lockFile.skills[existingIndex] = skill;
	} else {
		lockFile.skills.push(skill);
	}

	await writeSkillsLock(lockFile);
}

function getSkillIdFromUrl(url: string): string {
	const parsedUrl = new URL(url);
	const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
	const lastSegment = pathSegments.at(-1);

	if (lastSegment === undefined) {
		throw new Error(`Unable to determine skill id from URL: ${url}`);
	}

	const skillSegment =
		lastSegment.toLowerCase() === "skill.md" ? pathSegments.at(-2) : basename(lastSegment, ".md");

	if (skillSegment === undefined || skillSegment.trim() === "") {
		throw new Error(`Unable to determine skill id from URL: ${url}`);
	}

	return decodeURIComponent(skillSegment);
}

function isInstalledSkillRecord(value: unknown): value is InstalledSkill {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.id === "string" &&
		typeof candidate.name === "string" &&
		typeof candidate.url === "string" &&
		typeof candidate.installedAt === "string"
	);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
