import type { CreateWikiPageRequest, UpdateWikiPageRequest } from "@io/shared";
import { Router } from "express";

import {
	createPage,
	deletePage,
	getPage,
	listPages,
	searchPages,
	updatePage,
} from "../../wiki/index.js";

const router = Router();

router.get("/api/wiki/pages", async (_req, res) => {
	try {
		const pages = await listPages();
		res.status(200).json(pages);
	} catch (error) {
		res.status(500).json({
			error: "Failed to list wiki pages",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/wiki/pages/*pagePath", async (req, res) => {
	try {
		const pagePath = extractPagePath(req.params.pagePath);
		if (!pagePath) {
			res.status(400).json({ error: "Wiki page path is required" });
			return;
		}

		const page = await getPage(pagePath);
		if (!page) {
			res.status(404).json({ error: "Wiki page not found" });
			return;
		}

		res.status(200).json(page);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch wiki page",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/wiki/pages", async (req, res) => {
	try {
		const body = req.body as CreateWikiPageRequest | undefined;
		if (!body?.path?.trim() || !body?.title?.trim() || typeof body.content !== "string") {
			res.status(400).json({ error: "path, title, and content are required" });
			return;
		}

		const page = await createPage(
			body.path.trim(),
			body.title.trim(),
			body.content,
			body.tags ?? [],
		);
		res.status(201).json(page);
	} catch (error) {
		const statusCode =
			error instanceof Error && /already exists|invalid/i.test(error.message) ? 400 : 500;
		res.status(statusCode).json({
			error: "Failed to create wiki page",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/wiki/pages/*pagePath", async (req, res) => {
	try {
		const pagePath = extractPagePath(req.params.pagePath);
		if (!pagePath) {
			res.status(400).json({ error: "Wiki page path is required" });
			return;
		}

		const body = (req.body ?? {}) as UpdateWikiPageRequest;
		const page = await updatePage(pagePath, {
			title: typeof body.title === "string" ? body.title.trim() : undefined,
			content: typeof body.content === "string" ? body.content : undefined,
			tags: Array.isArray(body.tags) ? body.tags : undefined,
		});
		if (!page) {
			res.status(404).json({ error: "Wiki page not found" });
			return;
		}

		res.status(200).json(page);
	} catch (error) {
		res.status(500).json({
			error: "Failed to update wiki page",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/api/wiki/pages/*pagePath", async (req, res) => {
	try {
		const pagePath = extractPagePath(req.params.pagePath);
		if (!pagePath) {
			res.status(400).json({ error: "Wiki page path is required" });
			return;
		}

		const existingPage = await getPage(pagePath);
		if (!existingPage) {
			res.status(404).json({ error: "Wiki page not found" });
			return;
		}

		await deletePage(pagePath);
		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to delete wiki page",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/wiki/search", async (req, res) => {
	try {
		const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
		const limit = parsePositiveInteger(req.query.limit, 10);
		if (!query) {
			res.status(400).json({ error: "q is required" });
			return;
		}

		const pages = await searchPages(query, limit);
		res.status(200).json(pages);
	} catch (error) {
		res.status(500).json({
			error: "Failed to search wiki pages",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

function extractPagePath(value: unknown): string {
	if (Array.isArray(value)) {
		return value.join("/");
	}

	return typeof value === "string" ? value : "";
}

function parsePositiveInteger(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export { router as wikiRouter };
