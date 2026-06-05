import type { WikiPage } from "./wiki.js";
import { createPage, getPage, listPages, updatePage } from "./wiki.js";

const EPISODE_TAGS = ["episode", "daily-summary"];
const DEFAULT_EPISODE_LIMIT = 10;

export async function writeEpisode(date: string | Date, summary: string): Promise<WikiPage> {
	const normalizedDate = normalizeEpisodeDate(date);
	const pagePath = getEpisodePath(normalizedDate);
	const title = `Episode: ${normalizedDate}`;
	const existingEpisode = await getPage(pagePath);

	if (existingEpisode === null) {
		return createPage(pagePath, title, summary, EPISODE_TAGS);
	}

	const updatedEpisode = await updatePage(pagePath, {
		title,
		content: summary,
		tags: EPISODE_TAGS,
	});

	if (updatedEpisode === null) {
		throw new Error(`Failed to update episode page: ${pagePath}`);
	}

	return updatedEpisode;
}

export async function getEpisode(date: string | Date): Promise<WikiPage | null> {
	return getPage(getEpisodePath(normalizeEpisodeDate(date)));
}

export async function getRecentEpisodes(limit = DEFAULT_EPISODE_LIMIT): Promise<WikiPage[]> {
	const pages = await listPages();

	return pages
		.filter(
			(page) =>
				page.path.startsWith("episodes/") && /^episodes\/\d{4}-\d{2}-\d{2}\.md$/.test(page.path),
		)
		.sort((left, right) =>
			extractEpisodeDate(right.path).localeCompare(extractEpisodeDate(left.path)),
		)
		.slice(0, Math.max(limit, 0));
}

function getEpisodePath(date: string): string {
	return `episodes/${date}.md`;
}

function normalizeEpisodeDate(date: string | Date): string {
	if (date instanceof Date) {
		return date.toISOString().slice(0, 10);
	}

	const trimmedDate = date.trim();

	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
		return trimmedDate;
	}

	const parsedDate = new Date(trimmedDate);

	if (Number.isNaN(parsedDate.getTime())) {
		throw new Error(`Invalid episode date: ${date}`);
	}

	return parsedDate.toISOString().slice(0, 10);
}

function extractEpisodeDate(pagePath: string): string {
	return pagePath.slice("episodes/".length, -3);
}
