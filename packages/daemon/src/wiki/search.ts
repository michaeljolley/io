import type { WikiPage } from "./wiki.js";
import { listPages } from "./wiki.js";

const DEFAULT_SEARCH_LIMIT = 10;

export async function searchPages(
	query: string,
	limit = DEFAULT_SEARCH_LIMIT,
): Promise<WikiPage[]> {
	const normalizedQuery = query.trim().toLowerCase();

	if (normalizedQuery === "") {
		return [];
	}

	const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
	const pages = await listPages();

	return pages
		.map((page) => ({ page, score: scorePage(page, normalizedQuery, queryTokens) }))
		.filter((entry) => entry.score > 0)
		.sort(
			(left, right) =>
				right.score - left.score || right.page.updatedAt.localeCompare(left.page.updatedAt),
		)
		.slice(0, Math.max(limit, 0))
		.map((entry) => entry.page);
}

export async function getRecentPages(limit = DEFAULT_SEARCH_LIMIT): Promise<WikiPage[]> {
	const pages = await listPages();

	return pages
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
		.slice(0, Math.max(limit, 0));
}

export async function getPagesByTag(tag: string): Promise<WikiPage[]> {
	const normalizedTag = tag.trim().toLowerCase();

	if (normalizedTag === "") {
		return [];
	}

	const pages = await listPages();

	return pages
		.filter((page) => page.tags.some((pageTag) => pageTag.toLowerCase() === normalizedTag))
		.sort((left, right) => left.title.localeCompare(right.title));
}

function scorePage(page: WikiPage, query: string, tokens: string[]): number {
	const title = page.title.toLowerCase();
	const tags = page.tags.map((tag) => tag.toLowerCase());
	const content = page.content.toLowerCase();
	let score = 0;

	if (title.includes(query)) {
		score += 300;
	}

	for (const token of tokens) {
		if (title.includes(token)) {
			score += 100;
		}
	}

	for (const tag of tags) {
		if (tag.includes(query)) {
			score += 200;
			continue;
		}

		for (const token of tokens) {
			if (tag.includes(token)) {
				score += 60;
			}
		}
	}

	if (content.includes(query)) {
		score += 25;
	}

	for (const token of tokens) {
		if (content.includes(token)) {
			score += 10;
		}
	}

	return score;
}
