import { rm } from "node:fs/promises";

import {
	createPage,
	deletePage,
	getEpisode,
	getPage,
	getRecentEpisodes,
	getRecentPages,
	searchPages,
	setWikiDirectory,
	updatePage,
	writeEpisode,
} from "../src/wiki/index.js";
import { createTempDirectory, pause } from "./helpers.js";

describe("wiki", () => {
	let wikiDir: string;

	beforeEach(async () => {
		wikiDir = await createTempDirectory("wiki");
		setWikiDirectory(wikiDir);
	});

	afterEach(async () => {
		setWikiDirectory(null);
		await rm(wikiDir, { recursive: true, force: true });
	});

	it("creates and reads a page", async () => {
		const created = await createPage(
			"guides/testing",
			"Testing Guide",
			"Use Vitest for daemon tests.",
			["testing", "vitest"],
		);
		const page = await getPage("guides/testing");

		expect(created.path).toBe("guides/testing.md");
		expect(page?.title).toBe("Testing Guide");
		expect(page?.content.trim()).toBe("Use Vitest for daemon tests.");
		expect(page?.tags).toEqual(["testing", "vitest"]);
	});

	it("updates an existing page", async () => {
		await createPage("notes/roadmap", "Roadmap", "Initial plan", ["planning"]);
		await pause();
		const updated = await updatePage("notes/roadmap", {
			title: "Updated Roadmap",
			content: "Expanded plan",
			tags: ["planning", "delivery"],
		});

		expect(updated).not.toBeNull();
		expect(updated?.title).toBe("Updated Roadmap");
		expect(updated?.content).toBe("Expanded plan");
		expect(updated?.tags).toEqual(["planning", "delivery"]);
	});

	it("deletes a page and handles missing pages gracefully", async () => {
		await createPage("scratch/tmp", "Temporary", "Delete me");
		await deletePage("scratch/tmp");

		expect(await getPage("scratch/tmp")).toBeNull();
		expect(await getPage("missing/page")).toBeNull();
		expect(await updatePage("missing/page", { content: "No-op" })).toBeNull();
	});

	it("searches pages by keyword with title matches ranked ahead of content matches", async () => {
		await createPage("architecture/auth", "OAuth2 Migration", "Move auth to OAuth2 flows", [
			"security",
		]);
		await pause();
		await createPage("notes/incidents", "Incident Review", "OAuth2 token failure root cause", [
			"ops",
		]);

		const results = await searchPages("oauth2");

		expect(results.map((page) => page.path)).toEqual([
			"architecture/auth.md",
			"notes/incidents.md",
		]);
	});

	it("returns recent pages by updated timestamp", async () => {
		await createPage("a/first", "First", "One");
		await pause();
		await createPage("b/second", "Second", "Two");
		await pause();
		await updatePage("a/first", { content: "Three" });

		const recent = await getRecentPages(2);

		expect(recent.map((page) => page.path)).toEqual(["a/first.md", "b/second.md"]);
	});

	it("writes and updates episode pages", async () => {
		const created = await writeEpisode("2025-01-15", "Daily summary one");
		const updated = await writeEpisode("2025-01-15", "Daily summary two");
		const episode = await getEpisode("2025-01-15");

		expect(created.path).toBe("episodes/2025-01-15.md");
		expect(updated.content).toBe("Daily summary two");
		expect(episode?.title).toBe("Episode: 2025-01-15");
		expect(episode?.tags).toEqual(["episode", "daily-summary"]);
		expect(episode?.content.trim()).toBe("Daily summary two");
	});

	it("returns recent episodes in reverse chronological order", async () => {
		await writeEpisode("2025-01-13", "Older");
		await writeEpisode("2025-01-15", "Newest");
		await writeEpisode("2025-01-14", "Middle");

		const episodes = await getRecentEpisodes(3);

		expect(episodes.map((page) => page.path)).toEqual([
			"episodes/2025-01-15.md",
			"episodes/2025-01-14.md",
			"episodes/2025-01-13.md",
		]);
	});

	it("returns empty results for empty search queries and rejects invalid paths", async () => {
		expect(await searchPages("   ")).toEqual([]);
		await expect(createPage("../outside", "Invalid", "Nope")).rejects.toThrow(
			"Invalid wiki page path",
		);
	});
});
