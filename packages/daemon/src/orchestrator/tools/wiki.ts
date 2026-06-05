import { z } from "zod";

import type { ToolDefinition } from "../../copilot/session.js";
import { getRecentPages, searchPages } from "../../wiki/search.js";
import { createPage, getPage, updatePage } from "../../wiki/wiki.js";

import type { OrchestratorToolExecutor } from "./squad.js";

const wikiReadSchema = z.object({
	path: z.string().trim().min(1),
});

const wikiWriteSchema = z.object({
	path: z.string().trim().min(1),
	title: z.string().trim().min(1),
	content: z.string(),
	tags: z.array(z.string().trim().min(1)).optional(),
});

const wikiSearchSchema = z.object({
	query: z.string().trim().min(1),
	limit: z.number().int().positive().max(25).optional(),
});

const rememberSchema = z.object({
	content: z.string().trim().min(1),
	tags: z.array(z.string().trim().min(1)).optional(),
});

const recallSchema = z.object({
	query: z.string().trim().min(1),
});

export const wikiToolDefinitions: ToolDefinition[] = [
	{
		name: "wiki_read",
		description: "Read a wiki page by path.",
		parameters: wikiReadSchema,
		skipPermission: true,
	},
	{
		name: "wiki_write",
		description: "Create or update a wiki page.",
		parameters: wikiWriteSchema,
		skipPermission: true,
	},
	{
		name: "wiki_search",
		description: "Search wiki pages.",
		parameters: wikiSearchSchema,
		skipPermission: true,
	},
	{
		name: "remember",
		description: "Quickly save content to the wiki with a generated path.",
		parameters: rememberSchema,
		skipPermission: true,
	},
	{
		name: "recall",
		description: "Recall the best matching wiki note or page for a query.",
		parameters: recallSchema,
		skipPermission: true,
	},
];

function buildMemoryPath(timestamp: Date): string {
	const iso = timestamp.toISOString();
	const date = iso.slice(0, 10);
	const time = iso.slice(11, 19).replace(/:/gu, "-");
	return `memory/${date}/${time}.md`;
}

export const executeWikiToolCall: OrchestratorToolExecutor = async (toolName, rawArgs) => {
	switch (toolName) {
		case "wiki_read": {
			const { path } = wikiReadSchema.parse(rawArgs);
			const page = await getPage(path);
			if (!page) {
				throw new Error(`Wiki page not found: ${path}`);
			}
			return { page };
		}
		case "wiki_write": {
			const { path, title, content, tags } = wikiWriteSchema.parse(rawArgs);
			const existing = await getPage(path);
			const page = existing
				? await updatePage(path, { title, content, tags: tags ?? [] })
				: await createPage(path, title, content, tags ?? []);
			return {
				message: `${existing ? "Updated" : "Created"} wiki page ${path}.`,
				page,
			};
		}
		case "wiki_search": {
			const { query, limit } = wikiSearchSchema.parse(rawArgs);
			const pages = await searchPages(query, limit ?? 5);
			return {
				message:
					pages.length > 0
						? `Found ${pages.length} wiki page(s).`
						: "No wiki pages matched the query.",
				pages,
			};
		}
		case "remember": {
			const { content, tags } = rememberSchema.parse(rawArgs);
			const now = new Date();
			const path = buildMemoryPath(now);
			const title = `Memory ${now.toISOString()}`;
			const page = await createPage(path, title, content, tags ?? ["memory"]);
			return {
				message: `Stored note at ${page.path}.`,
				page,
			};
		}
		case "recall": {
			const { query } = recallSchema.parse(rawArgs);
			const [matches, recents] = await Promise.all([searchPages(query, 1), getRecentPages(1)]);
			const page = matches[0] ?? recents[0] ?? null;
			if (!page) {
				return { message: "No wiki content is available yet." };
			}
			return {
				message: `Best match: ${page.title}`,
				path: page.path,
				title: page.title,
				content: page.content,
				tags: page.tags,
			};
		}
		default:
			throw new Error(`Unsupported wiki tool: ${toolName}`);
	}
};
