import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import matter from "gray-matter";

import { SKILLS_DIR } from "@io/shared/paths";

export interface Skill {
	id: string;
	name: string;
	description: string;
	activation: string;
	content: string;
	path: string;
}

export async function scanSkills(): Promise<Skill[]> {
	const skillFilePaths = await collectSkillFiles(SKILLS_DIR);
	const skills = await Promise.all(skillFilePaths.map((filePath) => readSkillFromFile(filePath)));

	return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getSkill(id: string): Promise<Skill | null> {
	const skills = await scanSkills();
	return skills.find((skill) => skill.id === id) ?? null;
}

async function collectSkillFiles(directory: string): Promise<string[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		const skillFiles: string[] = [];

		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				skillFiles.push(...(await collectSkillFiles(entryPath)));
				continue;
			}

			if (entry.isFile() && entry.name === "SKILL.md") {
				skillFiles.push(entryPath);
			}
		}

		return skillFiles;
	} catch (error) {
		if (isMissingFileError(error)) {
			return [];
		}

		throw error;
	}
}

async function readSkillFromFile(filePath: string): Promise<Skill> {
	const rawContent = await readFile(filePath, "utf8");
	const parsed = matter(rawContent);
	const skillId = basename(dirname(filePath));

	return {
		id: skillId,
		name:
			typeof parsed.data.name === "string" && parsed.data.name.trim() !== ""
				? parsed.data.name
				: skillId,
		description: typeof parsed.data.description === "string" ? parsed.data.description.trim() : "",
		activation: typeof parsed.data.activation === "string" ? parsed.data.activation.trim() : "",
		content: parsed.content.trim(),
		path: filePath,
	};
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
