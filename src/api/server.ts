import express from "express";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Config } from "../config.js";
import { createAuthMiddleware } from "./auth.js";
import { sendToOrchestrator } from "../copilot/orchestrator.js";
import { listSquads, getSquad, getAgentsForSquad } from "../store/squads.js";
import { getTasksForSquad } from "../store/tasks.js";
import { getInstancesForSquad } from "../store/instances.js";
import {
  getFeedItems,
  markFeedItemRead,
  deleteFeedItem,
  getUnreadCount,
} from "../store/feed.js";
import { listSchedules, createSchedule, deleteSchedule, toggleSchedule } from "../store/schedules.js";
import { listServers, toggleMcpServer, addMcpServer, removeMcpServer } from "../mcp/index.js";
import { listSkills, addSkill, removeSkill } from "../copilot/skills.js";
import { readPage, writePage, deletePage, listPages } from "../wiki/fs.js";
import { searchPages } from "../wiki/search.js";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type SSEClient = {
  id: string;
  res: express.Response;
};

const sseClients: SSEClient[] = [];

function broadcast(event: string, data: any): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.res.write(payload);
  }
}

export async function startApiServer(config: Config): Promise<void> {
  const app = express();
  app.use(express.json());

  // Serve static web frontend
  const webDistPath = resolve(__dirname, "..", "..", "web-dist");
  app.use(express.static(webDistPath));

  // Auth middleware for all API routes
  const auth = createAuthMiddleware(config);
  app.use("/api", auth);

  // --- SSE Stream ---
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client: SSEClient = { id: randomUUID(), res };
    sseClients.push(client);

    res.write(`event: connected\ndata: ${JSON.stringify({ id: client.id })}\n\n`);

    req.on("close", () => {
      const idx = sseClients.indexOf(client);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // --- Chat ---
  app.post("/api/message", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Stream response via SSE, send final to HTTP response
    await sendToOrchestrator(prompt, "web", (content, done) => {
      broadcast("message_delta", { content, done });
      if (done) {
        res.json({ content });
      }
    });
  });

  // --- Squads ---
  app.get("/api/squads", (_req, res) => {
    res.json(listSquads());
  });

  app.get("/api/squads/:id", (req, res) => {
    const squad = getSquad(req.params.id);
    if (!squad) {
      res.status(404).json({ error: "Squad not found" });
      return;
    }
    const agents = getAgentsForSquad(req.params.id);
    const tasks = getTasksForSquad(req.params.id);
    const instances = getInstancesForSquad(req.params.id);
    res.json({ squad, agents, tasks, instances });
  });

  // --- Feed ---
  app.get("/api/feed", (req, res) => {
    const unreadOnly = req.query.unread === "true";
    const source = req.query.source as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    res.json({
      items: getFeedItems({ unreadOnly, source, limit, offset }),
      unreadCount: getUnreadCount(),
    });
  });

  app.post("/api/feed/:id/read", (req, res) => {
    markFeedItemRead(req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/feed/:id", (req, res) => {
    deleteFeedItem(req.params.id);
    res.json({ ok: true });
  });

  // --- MCP Servers ---
  app.get("/api/mcp", (_req, res) => {
    res.json(listServers());
  });

  app.post("/api/mcp", (req, res) => {
    const server = { id: randomUUID(), ...req.body, enabled: true };
    addMcpServer(server);
    res.json(server);
  });

  app.put("/api/mcp/:id", (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      toggleMcpServer(req.params.id, enabled);
    }
    res.json({ ok: true });
  });

  app.delete("/api/mcp/:id", (req, res) => {
    removeMcpServer(req.params.id);
    res.json({ ok: true });
  });

  // --- Skills ---
  app.get("/api/skills", async (_req, res) => {
    const skills = await listSkills();
    res.json(skills);
  });

  app.post("/api/skills", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        res.status(400).json({ error: "Missing 'url' in request body" });
        return;
      }
      await addSkill(url);
      res.status(201).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/skills/:slug", async (req, res) => {
    try {
      await removeSkill(req.params.slug);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // --- Wiki ---
  app.get("/api/wiki/pages", async (_req, res) => {
    const pages = await listPages();
    res.json(pages);
  });

  app.get("/api/wiki/page/*", async (req, res) => {
    try {
      const pagePath = (req.params as any)[0];
      const content = await readPage(pagePath);
      res.json({ path: pagePath, content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.put("/api/wiki/page/*", async (req, res) => {
    const pagePath = (req.params as any)[0];
    const { content } = req.body;
    await writePage(pagePath, content);
    res.json({ ok: true });
  });

  app.delete("/api/wiki/page/*", async (req, res) => {
    try {
      const pagePath = (req.params as any)[0];
      await deletePage(pagePath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get("/api/wiki/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: "q is required" });
      return;
    }
    const results = await searchPages(query);
    res.json(results);
  });

  // --- Schedules ---
  app.get("/api/schedules", (_req, res) => {
    const type = undefined; // return all
    res.json(listSchedules(type));
  });

  app.post("/api/schedules", (req, res) => {
    const schedule = createSchedule(req.body);
    res.json(schedule);
  });

  app.put("/api/schedules/:id", (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      toggleSchedule(req.params.id, enabled);
    }
    res.json({ ok: true });
  });

  app.delete("/api/schedules/:id", (req, res) => {
    deleteSchedule(req.params.id);
    res.json({ ok: true });
  });

  // --- Health (unauthenticated) ---
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: process.env.npm_package_version ?? "unknown" });
  });

  // SPA fallback — serve index.html for non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(join(webDistPath, "index.html"));
  });

  app.listen(config.port, () => {
    // Server started
  });
}

export { broadcast };
