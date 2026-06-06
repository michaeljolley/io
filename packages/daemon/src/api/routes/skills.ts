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

interface SkillSummary {
	name: string;
	activatedForOrchestrator: boolean;
	preview: string;
	description: string;
	filePath: string;
}

async function getSkillContent(skill: InstalledSkill): Promise<string> {
	if (!skill.entryFile) return "";
	const filePath = join(skill.directory, skill.entryFile);
	try {
		return await readFile(filePath, "utf8");
	} catch {
		return "";
	}
}

function stripFrontmatter(content: string): string {
	const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
	return match ? match[1] : content;
}

function extractDescription(content: string): string {
	const body = stripFrontmatter(content);
	const lines = body.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
	return lines[0]?.trim().slice(0, 200) ?? "";
}

function extractPreview(content: string): string {
	return stripFrontmatter(content).slice(0, 300);
}

async function buildSkillSummaries(skills: InstalledSkill[]): Promise<SkillSummary[]> {
	return Promise.all(
		skills.map(async (skill) => {
			const content = await getSkillContent(skill);
			return {
				name: skill.slug,
				activatedForOrchestrator: true,
				preview: extractPreview(content),
				description: extractDescription(content),
				filePath: skill.entryFile ? join(skill.directory, skill.entryFile) : skill.directory,
			};
		}),
	);
}

router.get("/api/skills", async (_req, res) => {
	try {
		const skills = await readInstalledSkills();
		const summaries = await buildSkillSummaries(skills);
		res.status(200).json({ skills: summaries });
	} catch (error) {
		res.status(500).json({
			error: "Failed to list skills",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/skills/discover", async (req, res) => {
	try {
		const source = typeof req.query.source === "string" ? req.query.source : "";
		const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

		if (source === "skillssh") {
			const skills = await discoverSkillsSh(query);
			res.status(200).json({ skills });
		} else if (source === "awesome-copilot") {
			const skills = await discoverAwesomeCopilot(query);
			res.status(200).json({ skills });
		} else {
			res.status(400).json({ error: `Unknown source: ${source}` });
		}
	} catch (error) {
		res.status(500).json({
			error: "Failed to discover skills",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/skills/:name", async (req, res) => {
	try {
		const skills = await readInstalledSkills();
		const skill = skills.find((s) => s.slug === req.params.name);
		if (!skill) {
			res.status(404).json({ error: "Skill not found" });
			return;
		}

		const content = await getSkillContent(skill);
		const filePath = skill.entryFile ? join(skill.directory, skill.entryFile) : skill.directory;
		res.status(200).json({ name: skill.slug, content, filePath });
	} catch (error) {
		res.status(500).json({
			error: "Failed to get skill",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/skills/:name", async (req, res) => {
	try {
		const skills = await readInstalledSkills();
		const skill = skills.find((s) => s.slug === req.params.name);
		if (!skill) {
			res.status(404).json({ error: "Skill not found" });
			return;
		}

		if (!skill.entryFile) {
			res.status(400).json({ error: "Skill has no entry file to update" });
			return;
		}

		const { content } = req.body as { content?: string };
		if (typeof content !== "string") {
			res.status(400).json({ error: "content is required" });
			return;
		}

		const filePath = join(skill.directory, skill.entryFile);
		await writeFile(filePath, content, "utf8");
		res.status(200).json({ name: skill.slug, content, filePath });
	} catch (error) {
		res.status(500).json({
			error: "Failed to update skill",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/skills/install", async (req, res) => {
	try {
		const body = req.body as
			| (InstallSkillRequest & { skillId?: string; name?: string })
			| undefined;
		if (!body?.url && !(body?.source && (body?.slug || body?.skillId || body?.name))) {
			res.status(400).json({ error: "Provide url or source+slug to install a skill" });
			return;
		}

		// Accept skillId or name as slug aliases from the web UI
		const normalized: InstallSkillRequest = {
			url: body.url,
			source: body.source,
			slug: body.slug || body.skillId || body.name,
		};

		const result = await installSkill(normalized);
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
		const identifier = req.params.id;
		const removed = await removeSkill(identifier);
		if (!removed) {
			// Try matching by slug (the frontend sends the slug as name)
			const removedBySlug = await removeSkillBySlug(identifier);
			if (!removedBySlug) {
				res.status(404).json({ error: "Skill not found" });
				return;
			}
		}

		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to remove skill",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
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
	let resolvedUrl = request.url;

	// For skills.sh skills, resolve the actual SKILL.md URL from the repo tree
	if (source === "skillssh" && resolvedUrl) {
		const fetchResult = await fetch(resolvedUrl);
		if (!fetchResult.ok) {
			// URL didn't work — try resolving from the repo tree
			resolvedUrl = (await resolveSkillsShUrl(request)) ?? resolvedUrl;
		}
	}

	if (resolvedUrl) {
		const response = await fetch(resolvedUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch skill from ${resolvedUrl} (${response.status})`);
		}

		const body = await response.text();
		entryFile = chooseEntryFileName(resolvedUrl, response.headers.get("content-type"));
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

async function removeSkillBySlug(slug: string): Promise<boolean> {
	const installedSkills = await readInstalledSkills();
	const skill = installedSkills.find((entry) => entry.slug === slug);
	if (!skill) {
		return false;
	}

	await rm(skill.directory, { recursive: true, force: true });
	await writeSkillsLock(installedSkills.filter((entry) => entry.slug !== slug));
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

// Resolve the actual SKILL.md path for a skills.sh skill by searching the repo tree
async function resolveSkillsShUrl(request: InstallSkillRequest): Promise<string | null> {
	// We need to find the skill in the source repo's tree
	// First, try the skills.sh API to get the source info
	const slug = request.slug?.trim();
	if (!slug) return null;

	try {
		const searchResponse = await fetch(
			`https://skills.sh/api/search?q=${encodeURIComponent(slug)}&limit=10`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		if (!searchResponse.ok) return null;

		const data = (await searchResponse.json()) as SkillsShSearchResponse;
		const match = data.skills?.find(
			(s) => s.skillId === slug || s.name === slug || s.id.endsWith(`/${slug}`),
		);
		if (!match?.source) return null;

		// Fetch the repo tree and find the SKILL.md for this skillId
		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "io-daemon",
		};
		if (process.env.GITHUB_TOKEN) {
			headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}

		const treeResponse = await fetch(
			`https://api.github.com/repos/${match.source}/git/trees/main?recursive=1`,
			{ headers, signal: AbortSignal.timeout(15_000) },
		);
		if (!treeResponse.ok) return null;

		const treeData = (await treeResponse.json()) as { tree: Array<{ path: string; type: string }> };
		// Find SKILL.md in a directory named after the skillId
		const skillFile = treeData.tree?.find(
			(entry) => entry.type === "blob" && entry.path.endsWith(`/${match.skillId}/SKILL.md`),
		);
		if (!skillFile) return null;

		return `https://raw.githubusercontent.com/${match.source}/main/${skillFile.path}`;
	} catch {
		return null;
	}
}

// --- Discovery sources ---

interface DiscoveredSkill {
	name: string;
	title: string;
	description: string;
	url: string;
	source: string;
	installed: boolean;
	registrySource?: string;
	skillId?: string;
	installs?: number;
}

interface SkillsShSearchResponse {
	skills: Array<{
		id: string;
		skillId: string;
		name: string;
		installs: number;
		source: string;
	}>;
	count: number;
}

async function discoverSkillsSh(query: string): Promise<DiscoveredSkill[]> {
	if (!query) return [];

	const endpoint = `https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=50`;
	const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
	if (!response.ok) {
		throw new Error(`skills.sh returned ${response.status}`);
	}

	const data = (await response.json()) as SkillsShSearchResponse;
	const installedSkills = await readInstalledSkills();
	const installedIds = new Set(installedSkills.map((s) => s.id));

	return (data.skills ?? []).map((entry) => {
		const skillUrl = entry.source
			? `https://raw.githubusercontent.com/${entry.source}/main/skills/${entry.skillId}/SKILL.md`
			: "";
		return {
			name: entry.name || entry.skillId,
			title: entry.name || entry.skillId,
			description: `${entry.source ?? ""}`,
			url: skillUrl,
			source: "skillssh",
			installed: installedIds.has(`skillssh:${normalizeSlug(entry.skillId || entry.name)}`),
			registrySource: entry.source ?? undefined,
			skillId: entry.skillId ?? undefined,
			installs: entry.installs ?? 0,
		};
	});
}

let awesomeCopilotCache: { skills: DiscoveredSkill[]; fetchedAt: number } | null = null;
const AWESOME_COPILOT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function discoverAwesomeCopilot(query: string): Promise<DiscoveredSkill[]> {
	const now = Date.now();
	if (!awesomeCopilotCache || now - awesomeCopilotCache.fetchedAt > AWESOME_COPILOT_CACHE_TTL) {
		awesomeCopilotCache = { skills: await fetchAwesomeCopilotList(), fetchedAt: now };
	}

	const skills = awesomeCopilotCache.skills;
	if (!query) return skills;

	const needle = query.toLowerCase();
	return skills.filter(
		(s) =>
			s.name.toLowerCase().includes(needle) ||
			s.title.toLowerCase().includes(needle) ||
			s.description.toLowerCase().includes(needle),
	);
}

interface GitHubTreeEntry {
	path: string;
	type: string;
}

async function fetchAwesomeCopilotList(): Promise<DiscoveredSkill[]> {
	const treeUrl = "https://api.github.com/repos/github/awesome-copilot/git/trees/main?recursive=1";
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "io-daemon",
	};
	if (process.env.GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	}

	const response = await fetch(treeUrl, { headers, signal: AbortSignal.timeout(15_000) });
	if (!response.ok) {
		throw new Error(`GitHub API returned ${response.status}`);
	}

	const data = (await response.json()) as { tree: GitHubTreeEntry[] };
	const installedSkills = await readInstalledSkills();
	const installedIds = new Set(installedSkills.map((s) => s.id));

	// Find all skills/{name}/SKILL.md entries
	const skillEntries = (data.tree ?? []).filter(
		(entry) =>
			entry.type === "blob" && entry.path.startsWith("skills/") && entry.path.endsWith("/SKILL.md"),
	);

	return skillEntries.map((entry) => {
		// path is "skills/{name}/SKILL.md"
		const parts = entry.path.split("/");
		const skillName = parts[1] ?? "unknown";
		const slug = normalizeSlug(skillName);
		const rawUrl = `https://raw.githubusercontent.com/github/awesome-copilot/main/${entry.path}`;

		return {
			name: skillName,
			title: skillName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			description: "From github/awesome-copilot",
			url: rawUrl,
			source: "awesome-copilot",
			installed: installedIds.has(`awesome-copilot:${slug}`),
		};
	});
}

export { router as skillsRouter };
