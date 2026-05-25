/**
 * Integration tests for MCP API endpoints (#279).
 *
 * Strategy: spin up a minimal Express server that mounts the same MCP route
 * handlers as src/api/server.ts, but pointed at a temp config file via
 * setMcpConfigPathForTests(). Tests make real HTTP requests using node:http.
 * The /mcp/reload endpoint uses an injectable reload fn to avoid pulling in
 * the full orchestrator (which needs DB + Copilot client).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import express, { type Request, type Response } from "express";
import { setMcpConfigPathForTests, resetMcpConfigPath, loadMcpConfig, saveMcpConfig } from "../mcp/config.js";

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
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
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

// ── Test server setup ─────────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let tmpDir: string;
let configPath: string;

function buildMcpApp(reloadFn: () => Promise<void> = async () => {}): express.Express {
  const app = express();
  app.use(express.json());

  app.get("/api/mcp/servers", (_req: Request, res: Response) => {
    try {
      const config = loadMcpConfig();
      res.json({ servers: config.servers });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/mcp/servers", (req: Request, res: Response) => {
    const { name, command, args, url, env } = req.body as {
      name?: string; command?: string; args?: string[]; url?: string; env?: Record<string, string>;
    };
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    if (!command && !url) { res.status(400).json({ error: "command or url is required" }); return; }
    try {
      const config = loadMcpConfig();
      if (config.servers.find(s => s.name === name)) {
        res.status(409).json({ error: "server already exists" }); return;
      }
      config.servers.push({ name, command, args, url, env, enabled: true });
      saveMcpConfig(config);
      res.status(201).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.delete("/api/mcp/servers/:name", (req: Request, res: Response) => {
    try {
      const config = loadMcpConfig();
      const idx = config.servers.findIndex(s => s.name === req.params.name);
      if (idx === -1) { res.status(404).json({ error: "server not found" }); return; }
      config.servers.splice(idx, 1);
      saveMcpConfig(config);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.patch("/api/mcp/servers/:name/toggle", (req: Request, res: Response) => {
    try {
      const config = loadMcpConfig();
      const srv = config.servers.find(s => s.name === req.params.name);
      if (!srv) { res.status(404).json({ error: "server not found" }); return; }
      srv.enabled = srv.enabled === false ? true : false;
      saveMcpConfig(config);
      res.json({ ok: true, enabled: srv.enabled });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/mcp/reload", async (_req: Request, res: Response) => {
    try {
      await reloadFn();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "reload failed" });
    }
  });

  return app;
}

before(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-mcp-api-test-"));
  configPath = join(tmpDir, "mcp.json");
  setMcpConfigPathForTests(configPath);

  await new Promise<void>((resolve) => {
    server = buildMcpApp().listen(0, "127.0.0.1", () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  resetMcpConfigPath();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Reset config file between tests
  saveMcpConfig({ servers: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/mcp/servers", () => {
  it("returns empty array when no servers configured", async () => {
    const res = await req("GET", port, "/api/mcp/servers");
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as { servers: unknown[] }).servers, []);
  });

  it("returns configured servers", async () => {
    saveMcpConfig({ servers: [{ name: "figma", command: "npx", enabled: true }] });
    const res = await req("GET", port, "/api/mcp/servers");
    assert.equal(res.status, 200);
    const { servers } = res.body as { servers: Array<{ name: string }> };
    assert.equal(servers.length, 1);
    assert.equal(servers[0].name, "figma");
  });
});

describe("POST /api/mcp/servers", () => {
  it("creates a stdio server successfully", async () => {
    const res = await req("POST", port, "/api/mcp/servers", {
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    });
    assert.equal(res.status, 201);
    assert.equal((res.body as { ok: boolean }).ok, true);

    const config = loadMcpConfig();
    assert.equal(config.servers.length, 1);
    assert.equal(config.servers[0].name, "github");
    assert.equal(config.servers[0].command, "npx");
    assert.deepEqual(config.servers[0].args, ["-y", "@modelcontextprotocol/server-github"]);
    assert.equal(config.servers[0].enabled, true);
  });

  it("creates an SSE server successfully", async () => {
    const res = await req("POST", port, "/api/mcp/servers", {
      name: "postgres",
      url: "http://localhost:3001/sse",
    });
    assert.equal(res.status, 201);

    const config = loadMcpConfig();
    assert.equal(config.servers[0].url, "http://localhost:3001/sse");
  });

  it("returns 400 when name is missing", async () => {
    const res = await req("POST", port, "/api/mcp/servers", { command: "npx" });
    assert.equal(res.status, 400);
    assert.ok((res.body as { error: string }).error.includes("name"));
  });

  it("returns 400 when both command and url are missing", async () => {
    const res = await req("POST", port, "/api/mcp/servers", { name: "bad-server" });
    assert.equal(res.status, 400);
    assert.ok((res.body as { error: string }).error.includes("command"));
  });

  it("returns 409 for duplicate server name", async () => {
    saveMcpConfig({ servers: [{ name: "figma", command: "npx" }] });
    const res = await req("POST", port, "/api/mcp/servers", { name: "figma", command: "npx" });
    assert.equal(res.status, 409);
    assert.ok((res.body as { error: string }).error.includes("already exists"));
  });
});

describe("DELETE /api/mcp/servers/:name", () => {
  it("removes an existing server", async () => {
    saveMcpConfig({ servers: [{ name: "figma", command: "npx" }, { name: "postgres", url: "http://localhost/sse" }] });

    const res = await req("DELETE", port, "/api/mcp/servers/figma");
    assert.equal(res.status, 200);
    assert.equal((res.body as { ok: boolean }).ok, true);

    const config = loadMcpConfig();
    assert.equal(config.servers.length, 1);
    assert.equal(config.servers[0].name, "postgres");
  });

  it("returns 404 for unknown server", async () => {
    const res = await req("DELETE", port, "/api/mcp/servers/nonexistent");
    assert.equal(res.status, 404);
    assert.ok((res.body as { error: string }).error.includes("not found"));
  });
});

describe("PATCH /api/mcp/servers/:name/toggle", () => {
  it("disables an enabled server", async () => {
    saveMcpConfig({ servers: [{ name: "figma", command: "npx", enabled: true }] });

    const res = await req("PATCH", port, "/api/mcp/servers/figma/toggle");
    assert.equal(res.status, 200);
    assert.equal((res.body as { ok: boolean; enabled: boolean }).enabled, false);

    assert.equal(loadMcpConfig().servers[0].enabled, false);
  });

  it("enables a disabled server", async () => {
    saveMcpConfig({ servers: [{ name: "figma", command: "npx", enabled: false }] });

    const res = await req("PATCH", port, "/api/mcp/servers/figma/toggle");
    assert.equal(res.status, 200);
    assert.equal((res.body as { ok: boolean; enabled: boolean }).enabled, true);
  });

  it("returns 404 for unknown server", async () => {
    const res = await req("PATCH", port, "/api/mcp/servers/nonexistent/toggle");
    assert.equal(res.status, 404);
    assert.ok((res.body as { error: string }).error.includes("not found"));
  });
});

describe("POST /api/mcp/reload", () => {
  it("calls reload function and returns ok", async () => {
    let reloadCalled = false;
    const app = buildMcpApp(async () => { reloadCalled = true; });

    await new Promise<void>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", async () => {
        const p = (s.address() as { port: number }).port;
        try {
          const res = await req("POST", p, "/api/mcp/reload");
          assert.equal(res.status, 200);
          assert.equal((res.body as { ok: boolean }).ok, true);
          assert.ok(reloadCalled, "reload function should have been called");
        } finally {
          s.close(() => resolve());
        }
      });
      s.on("error", reject);
    });
  });

  it("returns 500 when reload throws", async () => {
    const app = buildMcpApp(async () => { throw new Error("init failed"); });

    await new Promise<void>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", async () => {
        const p = (s.address() as { port: number }).port;
        try {
          const res = await req("POST", p, "/api/mcp/reload");
          assert.equal(res.status, 500);
          assert.ok((res.body as { error: string }).error.includes("init failed"));
        } finally {
          s.close(() => resolve());
        }
      });
      s.on("error", reject);
    });
  });
});
