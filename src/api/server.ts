import express from "express";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Config } from "../config.js";
import { loadConfig, saveConfig } from "../config.js";
import { createAuthMiddleware } from "./auth.js";
import { sendToOrchestrator } from "../copilot/orchestrator.js";
import { listSquads, getSquad, getAgentsForSquad } from "../store/squads.js";
import { getTasksForSquad, getSquadTaskMetrics } from "../store/tasks.js";
import { getInstancesForSquad, destroyInstance } from "../store/instances.js";
import { getAgentEvents } from "../store/agent-events.js";
import { getAuditLog, countAuditLog } from "../store/audit-log.js";
import {
  getFeedItems,
  markFeedItemRead,
  deleteFeedItem,
  getUnreadCount,
} from "../store/feed.js";
import { listSchedules, createSchedule, deleteSchedule, toggleSchedule } from "../store/schedules.js";
import { triggerSchedule } from "../copilot/trigger-schedule.js";
import { listServers, toggleMcpServer, addMcpServer, removeMcpServer } from "../mcp/index.js";
import { listSkills, addSkill, createSkill, removeSkill, getSkillContent, updateSkillContent, discoverSkills, installFromSource, fetchRemoteSkillPreview } from "../copilot/skills.js";
import { readPage, writePage, deletePage, listPages, listTemplates, readTemplate, writeTemplate, deleteTemplate } from "../wiki/fs.js";
import { searchPages } from "../wiki/search.js";
import { getBacklinks } from "../wiki/backlinks.js";
import {
  saveMessage,
  getConversation,
  listConversations,
  searchConversations,
  deleteConversation,
} from "../store/conversations.js";
import {
  getTokenUsageSummary,
  getTokenUsageBySquad,
  getTokenUsageByAgent,
  getDailyTokenUsage,
} from "../store/token-usage.js";
import { DEFAULT_MODEL_PRICING } from "../copilot/token-tracker.js";
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

  // Public endpoint — serves Supabase config to the frontend (no auth required)
  app.get("/api/auth/config", (_req, res) => {
    res.json({
      supabaseUrl: config.supabaseUrl ?? null,
      supabaseAnonKey: config.supabaseAnonKey ?? null,
    });
  });

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
    const { prompt, conversationId: clientConvId } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const conversationId = (typeof clientConvId === "string" && clientConvId) ? clientConvId : randomUUID();

    // Persist the user message
    saveMessage(conversationId, "user", prompt, "web");

    // Stream response via SSE, send final to HTTP response
    await sendToOrchestrator(prompt, "web", (content, done) => {
      broadcast("message_delta", { content, done });
      if (done) {
        // Persist the assistant response
        saveMessage(conversationId, "assistant", content, "web");
        res.json({ content, conversationId });
      }
    });
  });

  // --- History ---
  app.get("/api/history", (req, res) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (q) {
      res.json(searchConversations(q, { limit, offset, from, to }));
    } else {
      res.json(listConversations({ limit, offset, from, to }));
    }
  });

  app.get("/api/history/:id", (req, res) => {
    const messages = getConversation(req.params.id);
    if (messages.length === 0) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(messages);
  });

  app.delete("/api/history/:id", (req, res) => {
    deleteConversation(req.params.id);
    res.json({ ok: true });
  });

  // --- Squads ---
  app.get("/api/squads", (_req, res) => {
    const data = listSquads();
    const instanceCounts: Record<string, number> = {};
    for (const squad of data.squads) {
      instanceCounts[squad.id] = getInstancesForSquad(squad.id).length;
    }
    res.json({ ...data, instanceCounts });
  });

  // --- Squad Health Dashboard ---
  app.get("/api/squads/health", (_req, res) => {
    const { squads, agents } = listSquads();
    const health = squads.map((squad) => {
      const squadAgents = agents.filter((a) => a.squad_id === squad.id);
      const instances = getInstancesForSquad(squad.id);
      const metrics = getSquadTaskMetrics(squad.id);
      return {
        id: squad.id,
        name: squad.name,
        universe: squad.universe,
        agentCount: squadAgents.length,
        activeInstanceCount: instances.length,
        activeInstances: instances.map((inst) => ({
          id: inst.id,
          branch: inst.branch,
          lastActivity: inst.last_activity,
        })),
        tasksTotal: metrics.tasksTotal,
        tasksCompleted: metrics.tasksCompleted,
        tasksCompletedRecent: metrics.tasksCompletedRecent,
        tasksPending: metrics.tasksPending,
        tasksInProgress: metrics.tasksInProgress,
        tasksFailed: metrics.tasksFailed,
        avgCycleTimeMinutes: metrics.avgCycleTimeMinutes,
        isStalled: metrics.isStalled,
        recentTasks: metrics.recentTasks.map((t) => ({
          id: t.id,
          description: t.description,
          status: t.status,
          updatedAt: t.updated_at,
        })),
      };
    });
    res.json({ health });
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

  app.delete("/api/instances/:id", async (req, res) => {
    try {
      await destroyInstance(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      const status = msg.toLowerCase().includes("not found") ? 404 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // --- Task Events ---
  app.get("/api/tasks/:taskId/events", (req, res) => {
    const events = getAgentEvents(req.params.taskId);
    res.json(events);
  });

  // --- Stop Task ---
  app.post("/api/tasks/:taskId/stop", async (req, res) => {
    try {
      const { stopTask } = await import("../copilot/agents.js");
      await stopTask(req.params.taskId);
      res.json({ ok: true });
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      const isNotRunning = msg.toLowerCase().includes("not currently running") || msg.toLowerCase().includes("already completed");
      res.status(isNotRunning ? 404 : 500).json({ error: msg });
    }
  });

  // --- Audit Log ---
  app.get("/api/audit-log", (req, res) => {
    const squad_id = req.query.squad_id as string | undefined;
    const agent_id = req.query.agent_id as string | undefined;
    const action_type = req.query.action_type as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const filters = { squad_id, agent_id, action_type, from, to, limit, offset };
    res.json({
      entries: getAuditLog(filters),
      total: countAuditLog(filters),
    });
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

  app.get("/api/skills/discover", async (req, res) => {
    const source = req.query.source as string;
    if (source !== "awesome-copilot" && source !== "skillssh") {
      res.status(400).json({ error: "source must be 'awesome-copilot' or 'skillssh'" });
      return;
    }
    const q = req.query.q as string | undefined;
    try {
      const skills = await discoverSkills(source, q);
      res.json(skills);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/skills/preview", async (req, res) => {
    const source = req.query.source as string;
    const slug = req.query.slug as string;
    if (source !== "awesome-copilot" && source !== "skillssh") {
      res.status(400).json({ error: "source must be 'awesome-copilot' or 'skillssh'" });
      return;
    }
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }
    try {
      const content = await fetchRemoteSkillPreview(source, slug);
      res.json({ content });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/skills", async (req, res) => {
    try {
      const { url, source, slug, content } = req.body;
      if (source && slug) {
        if (source !== "awesome-copilot" && source !== "skillssh") {
          res.status(400).json({ error: "source must be 'awesome-copilot' or 'skillssh'" });
          return;
        }
        await installFromSource(source, slug);
      } else if (url && typeof url === "string") {
        // Git-clone method
        await addSkill(url);
      } else if (slug && typeof slug === "string" && content && typeof content === "string") {
        // Direct-creation method
        await createSkill(slug, content);
      } else {
        res.status(400).json({ error: "Provide 'url' (git clone), 'source' + 'slug' (community install), or 'slug' + 'content' (direct create)" });
        return;
      }
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

  app.get("/api/skills/:slug/content", async (req, res) => {
    try {
      const content = await getSkillContent(req.params.slug);
      res.json({ content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.put("/api/skills/:slug/content", async (req, res) => {
    try {
      const { content } = req.body;
      await updateSkillContent(req.params.slug, content);
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

  app.get("/api/wiki/page/*path", async (req, res) => {
    try {
      const raw = (req.params as any).path;
      const pagePath = Array.isArray(raw) ? raw.join("/") : raw;
      const content = await readPage(pagePath);
      res.json({ path: pagePath, content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.put("/api/wiki/page/*path", async (req, res) => {
    const raw = (req.params as any).path;
    const pagePath = Array.isArray(raw) ? raw.join("/") : raw;
    const { content } = req.body;
    await writePage(pagePath, content);
    res.json({ ok: true });
  });

  app.delete("/api/wiki/page/*path", async (req, res) => {
    try {
      const raw = (req.params as any).path;
      const pagePath = Array.isArray(raw) ? raw.join("/") : raw;
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

  app.get("/api/wiki/backlinks/*path", async (req, res) => {
    const raw = (req.params as any).path;
    const pagePath = Array.isArray(raw) ? raw.join("/") : raw;
    const backlinks = await getBacklinks(pagePath);
    res.json(backlinks);
  });

  // --- Wiki Templates ---
  app.get("/api/wiki/templates/squad", async (_req, res) => {
    const files = await listTemplates();
    res.json(files);
  });

  app.get("/api/wiki/template/squad/*path", async (req, res) => {
    try {
      const raw = (req.params as any).path;
      const templatePath = Array.isArray(raw) ? raw.join("/") : raw;
      const content = await readTemplate(templatePath);
      res.json({ path: templatePath, content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.put("/api/wiki/template/squad/*path", async (req, res) => {
    const raw = (req.params as any).path;
    const templatePath = Array.isArray(raw) ? raw.join("/") : raw;
    const { content } = req.body;
    await writeTemplate(templatePath, content);
    res.json({ ok: true });
  });

  app.delete("/api/wiki/template/squad/*path", async (req, res) => {
    try {
      const raw = (req.params as any).path;
      const templatePath = Array.isArray(raw) ? raw.join("/") : raw;
      await deleteTemplate(templatePath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // --- Schedules ---
  app.get("/api/schedules", (_req, res) => {
    const type = undefined; // return all
    res.json(listSchedules(type));
  });

  app.post("/api/schedules", (req, res) => {
    const { type, cron, squad_id, agenda, prompt } = req.body ?? {};
    if (type !== "squad" && type !== "io") {
      res.status(400).json({ error: "type must be 'squad' or 'io'" });
      return;
    }
    if (!cron || typeof cron !== "string") {
      res.status(400).json({ error: "cron is required" });
      return;
    }
    if (!squad_id || typeof squad_id !== "string" || !squad_id.trim()) {
      res.status(400).json({ error: "squad_id is required" });
      return;
    }

    const schedule = createSchedule({ type, cron, squad_id, agenda, prompt });
    res.json(schedule);
  });

  app.put("/api/schedules/:id", (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      toggleSchedule(req.params.id, enabled);
    }
    res.json({ ok: true });
  });

  app.post("/api/schedules/:id/trigger", (req, res) => {
    const schedule = triggerSchedule(req.params.id);
    if (!schedule) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    res.json({ ok: true, schedule });
  });

  app.delete("/api/schedules/:id", (req, res) => {
    deleteSchedule(req.params.id);
    res.json({ ok: true });
  });

  // --- Settings ---
  app.get("/api/settings", (_req, res) => {
    const current = loadConfig();
    // Don't expose full Supabase key — mask it
    res.json({
      defaultModel: current.defaultModel,
      port: current.port,
      telegramEnabled: current.telegramEnabled,
      telegramBotToken: current.telegramBotToken ? "••••••••" : "",
      authorizedUserId: current.authorizedUserId ?? null,
      supabaseUrl: current.supabaseUrl ?? "",
      supabaseAnonKey: current.supabaseAnonKey ? "••••••••" : "",
      authorizedEmail: current.authorizedEmail ?? "",
      backgroundNotifyMode: current.backgroundNotifyMode,
      backgroundNotifyTelegram: current.backgroundNotifyTelegram,
      selfEditEnabled: current.selfEditEnabled,
      watchdogEnabled: current.watchdogEnabled,
    });
  });

  app.put("/api/settings", (req, res) => {
    const updates: Partial<Config> = {};
    const body = req.body;

    // Only apply fields that are explicitly provided and not masked
    if (body.defaultModel !== undefined) updates.defaultModel = body.defaultModel;
    if (body.port !== undefined) updates.port = body.port;
    if (body.telegramEnabled !== undefined) updates.telegramEnabled = body.telegramEnabled;
    if (body.telegramBotToken && body.telegramBotToken !== "••••••••") updates.telegramBotToken = body.telegramBotToken;
    if (body.authorizedUserId !== undefined) updates.authorizedUserId = body.authorizedUserId;
    if (body.supabaseUrl !== undefined) updates.supabaseUrl = body.supabaseUrl;
    if (body.supabaseAnonKey && body.supabaseAnonKey !== "••••••••") updates.supabaseAnonKey = body.supabaseAnonKey;
    if (body.authorizedEmail !== undefined) updates.authorizedEmail = body.authorizedEmail;
    if (body.backgroundNotifyMode !== undefined) updates.backgroundNotifyMode = body.backgroundNotifyMode;
    if (body.backgroundNotifyTelegram !== undefined) updates.backgroundNotifyTelegram = body.backgroundNotifyTelegram;
    if (body.selfEditEnabled !== undefined) updates.selfEditEnabled = body.selfEditEnabled;
    if (body.watchdogEnabled !== undefined) updates.watchdogEnabled = body.watchdogEnabled;

    saveConfig(updates);
    res.json({ ok: true });
  });

  // --- Token Usage ---
  app.get("/api/token-usage/summary", (req, res) => {
    const since = req.query.since as string | undefined;
    res.json(getTokenUsageSummary({ since }));
  });

  app.get("/api/token-usage/by-squad", (req, res) => {
    const since = req.query.since as string | undefined;
    res.json(getTokenUsageBySquad({ since }));
  });

  app.get("/api/token-usage/by-agent", (req, res) => {
    const since = req.query.since as string | undefined;
    const squadId = req.query.squad_id as string | undefined;
    res.json(getTokenUsageByAgent({ since, squadId }));
  });

  app.get("/api/token-usage/daily", (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    res.json(getDailyTokenUsage(days));
  });

  app.get("/api/token-usage/pricing", (_req, res) => {
    const config = loadConfig();
    const merged = { ...DEFAULT_MODEL_PRICING, ...(config.modelPricing ?? {}) };
    res.json(merged);
  });

  app.put("/api/token-usage/pricing", (req, res) => {
    const pricing = req.body;
    if (typeof pricing !== "object" || pricing === null) {
      res.status(400).json({ error: "Expected object body" });
      return;
    }
    saveConfig({ modelPricing: pricing });
    res.json({ ok: true });
  });

  app.get("/api/token-usage/alert-threshold", (_req, res) => {
    const config = loadConfig();
    res.json({ tokenAlertThreshold: config.tokenAlertThreshold ?? null });
  });

  app.put("/api/token-usage/alert-threshold", (req, res) => {
    const { tokenAlertThreshold } = req.body;
    if (tokenAlertThreshold !== null && typeof tokenAlertThreshold !== "number") {
      res.status(400).json({ error: "tokenAlertThreshold must be a number or null" });
      return;
    }
    saveConfig({ tokenAlertThreshold: tokenAlertThreshold ?? undefined });
    res.json({ ok: true });
  });

  // --- Health (unauthenticated) ---
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: process.env.npm_package_version ?? "unknown" });
  });

  // SPA fallback — serve index.html for non-API routes
  app.get("*splat", (_req, res) => {
    res.sendFile(join(webDistPath, "index.html"));
  });

  app.listen(config.port, () => {
    // Server started
  });
}

export { broadcast };
