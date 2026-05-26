/**
 * Integration tests for Wiki API endpoints (#312).
 * Tests POST, PUT, DELETE endpoints for wiki pages.
 */
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import express, { type Request, type Response } from "express";
import {
  listPages,
  readPage,
  writePage,
  deletePage,
  assertPagePath,
  ensureWikiStructure,
} from "../wiki/fs.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(
  method: string,
  port: number,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Server Setup ──────────────────────────────────────────────────────────────

function createTestServer(): express.Application {
  const app = express();
  app.use(express.json());

  // Wiki list
  app.get("/api/wiki", (_req: Request, res: Response) => {
    try {
      const pages = listPages();
      const result = pages.map((pagePath) => {
        const pageContent = readPage(pagePath);
        const title = pageContent?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? pagePath;
        return { path: pagePath, title };
      });
      res.json({ pages: result });
    } catch (e) {
      res.status(500).json({ error: "Failed to list wiki pages" });
    }
  });

  // Wiki read
  app.get("/api/wiki/*path", (req: Request, res: Response) => {
    const pagePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    if (!pagePath) {
      res.status(400).json({ error: "Missing page path" });
      return;
    }
    const pageContent = readPage(pagePath);
    if (pageContent === undefined) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json({ path: pagePath, content: pageContent });
  });

  // Wiki create
  app.post("/api/wiki", (req: Request, res: Response) => {
    const { path: pagePath, content } = req.body as { path?: string; content?: string };
    if (!pagePath || typeof pagePath !== "string") {
      res.status(400).json({ error: "Missing page path" });
      return;
    }
    if (content === undefined || typeof content !== "string") {
      res.status(400).json({ error: "Missing page content" });
      return;
    }
    try {
      assertPagePath(pagePath);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    if (readPage(pagePath) !== undefined) {
      res.status(409).json({ error: "Page already exists" });
      return;
    }
    writePage(pagePath, content);
    res.status(201).json({ path: pagePath, content });
  });

  // Wiki update
  app.put("/api/wiki/*path", (req: Request, res: Response) => {
    const pagePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    if (!pagePath) {
      res.status(400).json({ error: "Missing page path" });
      return;
    }
    const { content } = req.body as { content?: string };
    if (content === undefined || typeof content !== "string") {
      res.status(400).json({ error: "Missing page content" });
      return;
    }
    try {
      assertPagePath(pagePath);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    if (readPage(pagePath) === undefined) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    writePage(pagePath, content);
    res.json({ path: pagePath, content });
  });

  // Wiki delete
  app.delete("/api/wiki/*path", (req: Request, res: Response) => {
    const pagePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    if (!pagePath) {
      res.status(400).json({ error: "Missing page path" });
      return;
    }
    try {
      assertPagePath(pagePath);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    const deleted = deletePage(pagePath);
    if (!deleted) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.status(204).send();
  });

  // Wiki categories
  app.get("/api/wiki-categories", (_req: Request, res: Response) => {
    res.json({ categories: ["preferences", "projects", "people", "general", "squads"] });
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Wiki API Endpoints", () => {
  let server: http.Server;
  let port: number;
  const testPagePath = `pages/general/test-wiki-api-${Date.now()}.md`;

  before(() => {
    ensureWikiStructure();
    const app = createTestServer();
    server = app.listen(0);
    port = (server.address() as { port: number }).port;
  });

  after(() => {
    server.close();
    // Clean up test page if exists
    try { deletePage(testPagePath); } catch { /* ignore */ }
  });

  afterEach(() => {
    // Clean up test page after each test
    try { deletePage(testPagePath); } catch { /* ignore */ }
  });

  describe("GET /api/wiki", () => {
    it("returns list of wiki pages", async () => {
      const { status, body } = await req("GET", port, "/api/wiki");
      assert.equal(status, 200);
      assert.ok(Array.isArray((body as { pages: unknown[] }).pages));
    });
  });

  describe("GET /api/wiki-categories", () => {
    it("returns available categories", async () => {
      const { status, body } = await req("GET", port, "/api/wiki-categories");
      assert.equal(status, 200);
      const categories = (body as { categories: string[] }).categories;
      assert.ok(categories.includes("general"));
      assert.ok(categories.includes("projects"));
      assert.ok(categories.includes("preferences"));
    });
  });

  describe("POST /api/wiki", () => {
    it("creates a new wiki page", async () => {
      const { status, body } = await req("POST", port, "/api/wiki", {
        path: testPagePath,
        content: "# Test Page\n\nThis is a test.",
      });
      assert.equal(status, 201);
      assert.equal((body as { path: string }).path, testPagePath);
      
      // Verify it was created
      const page = readPage(testPagePath);
      assert.ok(page?.includes("# Test Page"));
    });

    it("returns 409 if page already exists", async () => {
      writePage(testPagePath, "# Existing");
      const { status, body } = await req("POST", port, "/api/wiki", {
        path: testPagePath,
        content: "# New Content",
      });
      assert.equal(status, 409);
      assert.equal((body as { error: string }).error, "Page already exists");
    });

    it("returns 400 for missing path", async () => {
      const { status } = await req("POST", port, "/api/wiki", {
        content: "# Test",
      });
      assert.equal(status, 400);
    });

    it("returns 400 for missing content", async () => {
      const { status } = await req("POST", port, "/api/wiki", {
        path: testPagePath,
      });
      assert.equal(status, 400);
    });

    it("returns 400 for invalid path (not under pages/)", async () => {
      const { status, body } = await req("POST", port, "/api/wiki", {
        path: "invalid/path.md",
        content: "# Test",
      });
      assert.equal(status, 400);
      assert.ok((body as { error: string }).error.includes("pages/"));
    });
  });

  describe("PUT /api/wiki/*path", () => {
    it("updates an existing wiki page", async () => {
      writePage(testPagePath, "# Original Content");
      
      const { status, body } = await req("PUT", port, `/api/wiki/${testPagePath}`, {
        content: "# Updated Content\n\nNew text here.",
      });
      assert.equal(status, 200);
      assert.equal((body as { path: string }).path, testPagePath);
      
      // Verify it was updated
      const page = readPage(testPagePath);
      assert.ok(page?.includes("Updated Content"));
    });

    it("returns 404 if page does not exist", async () => {
      const { status, body } = await req("PUT", port, `/api/wiki/${testPagePath}`, {
        content: "# New Content",
      });
      assert.equal(status, 404);
      assert.equal((body as { error: string }).error, "Page not found");
    });

    it("returns 400 for missing content", async () => {
      writePage(testPagePath, "# Original");
      const { status } = await req("PUT", port, `/api/wiki/${testPagePath}`, {});
      assert.equal(status, 400);
    });
  });

  describe("DELETE /api/wiki/*path", () => {
    it("deletes an existing wiki page", async () => {
      writePage(testPagePath, "# To Delete");
      
      const { status } = await req("DELETE", port, `/api/wiki/${testPagePath}`);
      assert.equal(status, 204);
      
      // Verify it was deleted
      const page = readPage(testPagePath);
      assert.equal(page, undefined);
    });

    it("returns 404 if page does not exist", async () => {
      const { status, body } = await req("DELETE", port, `/api/wiki/${testPagePath}`);
      assert.equal(status, 404);
      assert.equal((body as { error: string }).error, "Page not found");
    });

    it("returns 400 for invalid path", async () => {
      const { status, body } = await req("DELETE", port, "/api/wiki/invalid-path.md");
      assert.equal(status, 400);
      assert.ok((body as { error: string }).error.includes("pages/"));
    });
  });
});
