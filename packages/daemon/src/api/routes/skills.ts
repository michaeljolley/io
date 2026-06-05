import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import type { InstallSkillRequest } from "@io/shared";
import { SKILLS_DIR, SKILLS_LOCK_PATH } from "@io/shared/paths";
import { Router } from "express";

const router = Router();

interface InstalledSkill {
	id: string;
	slug: string;
	source: string;
	url: string | null;
	installedAt: string;
	directory: string;
	entryFile: string | null;
}

router.get("/api/skills", async (_req, res) => {
	try {
		res.status(200).json(await readInstalledSkills());
	} catch (error) {
		res.status(500).json({
			error: "Failed to list skills",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/skills/install", async (req, res) => {
	try {
		const body = req.body as InstallSkillRequest | undefined;
		if (!body?.url && !(body?.source && body?.slug)) {
			res.status(400).json({ error: "Provide url or source+slug to install a skill" });
			return;
		}

		const result = await installSkill(body);
		res.status(result.created ? 201 : 200).json(result.skill);
	} catch (error) {
		const statusCode =
			error instanceof Error && /Invalid skill|fetch/i.test(error.message) ? 400 : 500;
		res.status(statusCode).json({
			error: "Failed to install skill",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/api/skills/:id", async (req, res) => {
	try {
		const removed = await removeSkill(req.params.id);
		if (!removed) {
			res.status(404).json({ error: "Skill not found" });
			return;
		}

		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to remove skill",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/skills/discover", async (_req, res) => {
	res.status(200).json([]);
});

async function installSkill(
	request: InstallSkillRequest,
): Promise<{ created: boolean; skill: InstalledSkill }> {
	await mkdir(SKILLS_DIR, { recursive: true });
	const installedSkills = await readInstalledSkills();
	const source = request.source?.trim() || (request.url ? "url" : "unknown");
	const slug = normalizeSlug(request.slug?.trim() || deriveSlugFromRequest(request));
	const id = `${source}:${slug}`;
	const directoryName = `${source.replace(/[^a-z0-9-]/gi, "-")}-${slug}`;
	const directory = join(SKILLS_DIR, directoryName);
	const existing = installedSkills.find((skill) => skill.id === id);
	let entryFile: string | null = existing?.entryFile ?? null;

	if (request.url) {
		const response = await fetch(request.url);
		if (!response.ok) {
			throw new Error(`Failed to fetch skill from ${request.url}`);
		}

		const body = await response.text();
		entryFile = chooseEntryFileName(request.url, response.headers.get("content-type"));
		await mkdir(directory, { recursive: true });
		await writeFile(join(directory, entryFile), body, "utf8");
	} else {
		await mkdir(directory, { recursive: true });
	}

	const installedAt = existing?.installedAt ?? new Date().toISOString();
	const skill: InstalledSkill = {
		id,
		slug,
		source,
		url: request.url ?? null,
		installedAt,
		directory,
		entryFile,
	};

	await writeFile(join(directory, "manifest.json"), `${JSON.stringify(skill, null, 2)}\n`, "utf8");
	const nextSkills = [...installedSkills.filter((entry) => entry.id !== id), skill].sort(
		(left, right) => left.id.localeCompare(right.id),
	);
	await writeSkillsLock(nextSkills);
	return { created: !existing, skill };
}

async function removeSkill(skillId: string): Promise<boolean> {
	const installedSkills = await readInstalledSkills();
	const skill = installedSkills.find((entry) => entry.id === skillId);
	if (!skill) {
		return false;
	}

	await rm(skill.directory, { recursive: true, force: true });
	await writeSkillsLock(installedSkills.filter((entry) => entry.id !== skillId));
	return true;
}

async function readInstalledSkills(): Promise<InstalledSkill[]> {
	try {
		const raw = await readFile(SKILLS_LOCK_PATH, "utf8");
		const parsed = JSON.parse(raw) as InstalledSkill[];
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		if (isMissingFileError(error)) {
			return [];
		}

		throw error;
	}
}

async function writeSkillsLock(skills: InstalledSkill[]): Promise<void> {
	await mkdir(SKILLS_DIR, { recursive: true });
	await writeFile(SKILLS_LOCK_PATH, `${JSON.stringify(skills, null, 2)}\n`, "utf8");
}

function deriveSlugFromRequest(request: InstallSkillRequest): string {
	if (request.url) {
		const url = new URL(request.url);
		const rawName = basename(url.pathname) || url.hostname;
		const strippedExtension = extname(rawName)
			? rawName.slice(0, -extname(rawName).length)
			: rawName;
		return strippedExtension || url.hostname;
	}

	if (request.slug) {
		return request.slug;
	}

	throw new Error("Invalid skill install request");
}

function normalizeSlug(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!normalized) {
		throw new Error("Invalid skill slug");
	}

	return normalized;
}

function chooseEntryFileName(url: string, contentType: string | null): string {
	if (contentType?.includes("json")) {
		return "skill.json";
	}

	if (contentType?.includes("markdown")) {
		return "README.md";
	}

	const pathname = new URL(url).pathname;
	const fileName = basename(pathname);
	if (fileName && fileName !== "/") {
		return fileName;
	}

	return "skill.txt";
}

function isMissingFileError(error: unknown): boolean {
	return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export { router as skillsRouter };
