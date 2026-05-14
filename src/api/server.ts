import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import express, { type Request, type Response } from "express";
import { config } from "../config.js";
import { listSkills, installSkill } from "../copilot/skills.js";
import { listSquads, createSquad, listSquadAgents } from "../store/squads.js";
import { getAgentInfo, cancelAgentTask, getTaskEvents, subscribeToTaskEvents } from "../copilot/agents.js";
import { summarize, summarizeEvent } from "../copilot/event-summary.js";
import { abortOrchestrator } from "../copilot/orchestrator.js";
import { getActiveTasks, getTask, listRecentTasks } from "../store/tasks.js";
import { IO_VERSION, SKILLS_DIR } from "../paths.js";
import { requireAuth } from "./auth.js";
import { listSchedules, getSchedule, deleteSchedule, setScheduleEnabled } from "../store/schedules.js";
import { listIoSchedules, getIoSchedule, deleteIoSchedule, setIoScheduleEnabled } from "../store/io-schedules.js";
import { getScheduleRuns } from "../store/schedule-runs.js";
import { listPages, readPage } from "../wiki/fs.js";
import { runScheduleNow } from "../copilot/scheduler.js";
import { runIoScheduleNow } from "../copilot/io-scheduler.js";
import {
  listRecentNotifications,
  listUnreadNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../store/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, "../../web-dist");

export type ApiMessageHandler = (
  text: string,
  connectionId: string,
  callback: (text: string, done: boolean) => void,
) => Promise<void>;

let messageHandler: ApiMessageHandler | undefined;

const sseConnections = new Set<Response>();

export function setMessageHandler(handler: ApiMessageHandler): void {
  messageHandler = handler;
}

export function broadcastToSSE(text: string): void {
  const payload = JSON.stringify({ type: "delta", text });
  for (const res of sseConnections) {
    res.write(`data: ${payload}\n\n`);
  }
}

export interface BroadcastNotificationPayload {
  id: number;
  source: { type: string; [key: string]: unknown };
  title: string;
  text: string;
  createdAt: string;
}

export function broadcastNotificationToSSE(payload: BroadcastNotificationPayload): void {
  const data = JSON.stringify({ type: "notification", ...payload });
  for (const res of sseConnections) {
    res.write(`data: ${data}\n\n`);
  }
}

export async function startApiServer(): Promise<void> {
  const app = express();

  app.use(express.json());

  app.use((_req: Request, res: Response, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Build API router
  const api = express.Router();

  // Public endpoints (no auth required)
  api.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  api.get("/auth/config", (_req: Request, res: Response) => {
    const authEnabled = !!(config.supabaseUrl && config.supabaseAnonKey);
    res.json({
      authEnabled,
      supabaseUrl: config.supabaseUrl ?? null,
      supabaseAnonKey: config.supabaseAnonKey ?? null,
    });
  });

  // Apply auth middleware to all subsequent routes
  api.use(requireAuth);

  api.get("/status", (_req: Request, res: Response) => {
    res.json({ version: IO_VERSION, uptime: process.uptime() });
  });

  // Skills endpoints
  api.get("/skills", (_req: Request, res: Response) => {
    try {
      const skills = listSkills();
      res.json({ skills });
    } catch (e) {
      console.error("Error listing skills:", e);
      res.status(500).json({ error: "Failed to list skills" });
    }
  });


  // Get a single skill's SKILL.md content by slug (issue #119)
  api.get("/skills/:slug", (req: Request, res: Response) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
      res.status(400).json({ error: "Invalid skill slug" });
      return;
    }
    const skillFile = `${SKILLS_DIR}/${slug}/SKILL.md`;
    try {
      if (!existsSync(skillFile)) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }
      const content = readFileSync(skillFile, "utf-8");
      res.json({ slug, content });
    } catch (e) {
      console.error("Error reading skill content:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Install a skill from a git repo URL (mirrors the skill_install tool)
  api.post("/skills", async (req: Request, res: Response) => {
    const { repoUrl } = req.body as { repoUrl?: unknown };

    if (repoUrl === undefined || repoUrl === null || typeof repoUrl !== "string") {
      res.status(400).json({ error: "Missing required field: repoUrl" });
      return;
    }
    if (repoUrl.trim() === "") {
      res.status(400).json({ error: "repoUrl must not be empty" });
      return;
    }
    const trimmed = repoUrl.trim();
    const looksLikeGitUrl =
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("git@") ||
      trimmed.startsWith("git://") ||
      trimmed.endsWith(".git");
    if (!looksLikeGitUrl) {
      res.status(400).json({ error: "repoUrl does not look like a git repository URL" });
      return;
    }

    try {
      const skill = await installSkill(trimmed);
      res.status(201).json({ skill });
    } catch (e) {
      console.error("Error installing skill:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Squads endpoints
  api.get("/squads", (_req: Request, res: Response) => {
    try {
      const squads = listSquads();
      res.json({ squads });
    } catch (e) {
      console.error("Error listing squads:", e);
      res.status(500).json({ error: "Failed to list squads" });
    }
  });

  api.post("/squads", (req: Request, res: Response) => {
    try {
      const { slug, name, projectPath } = req.body as {
        slug?: string;
        name?: string;
        projectPath?: string;
      };

      if (!slug || !name || !projectPath) {
        res.status(400).json({ error: "Missing required fields: slug, name, projectPath" });
        return;
      }

      const squad = createSquad(slug, name, projectPath);
      res.json({ squad });
    } catch (e) {
      console.error("Error creating squad:", e);
      res.status(500).json({ error: "Failed to create squad" });
    }
  });

  api.get("/squads/:slug/agents", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const agents = listSquadAgents(slug);
      const activeTasks = getActiveTasks();
      const taskByKey = new Map<string, { task_id: string; description: string }>();
      for (const t of activeTasks) {
        taskByKey.set(t.agent_slug, { task_id: t.task_id, description: t.description });
      }
      const enriched = agents.map((a) => {
        const key = `${slug}:${a.character_name}`;
        const task = taskByKey.get(key) ?? taskByKey.get(slug);
        return {
          ...a,
          currentTaskId: task?.task_id ?? null,
          currentTask: task?.description ?? null,
        };
      });
      res.json({ agents: enriched });
    } catch (e) {
      console.error("Error listing squad agents:", e);
      res.status(500).json({ error: "Failed to list squad agents" });
    }
  });

  // Agents endpoints
  api.get("/agents", (_req: Request, res: Response) => {
    try {
      const agents = getAgentInfo();
      res.json({ agents });
    } catch (e) {
      console.error("Error listing agents:", e);
      res.status(500).json({ error: "Failed to list agents" });
    }
  });

  // Task history endpoints
  api.get("/tasks", (req: Request, res: Response) => {
    try {
      const limitRaw = req.query.limit;
      const parsed = typeof limitRaw === "string" ? parseInt(limitRaw, 10) : NaN;
      const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
      const tasks = listRecentTasks(limit);
      res.json({ tasks });
    } catch (e) {
      console.error("Error listing tasks:", e);
      res.status(500).json({ error: "Failed to list tasks" });
    }
  });

  api.get("/tasks/:taskId", (req: Request, res: Response) => {
    try {
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      const task = getTask(taskId);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json({ task });
    } catch (e) {
      console.error("Error fetching task:", e);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  api.get("/tasks/:taskId/activity", (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    try {
      const events = getTaskEvents(taskId);
      let activity = summarize(events);

      // Fallback: when in-memory events are gone (e.g. daemon restart),
      // build a minimal entry from the persisted task result so the UI
      // doesn't show "no activity" for tasks that actually ran. (#66)
      if (activity.length === 0) {
        const task = getTask(taskId);
        if (task?.result) {
          activity = [{
            ts: task.completed_at ? new Date(task.completed_at).getTime() : Date.now(),
            kind: "outcome" as const,
            icon: task.status === "failed" ? "\u274c" : task.status === "done" ? "\u2705" : "\ud83d\udccb",
            summary: task.status === "failed"
              ? "Task failed (activity log unavailable after restart)"
              : "Task completed (activity log unavailable after restart)",
            rawType: "task.result.fallback",
            detail: task.result,
            raw: { result: task.result, status: task.status },
          }];
        }
      }

      res.json({ taskId, activity });
    } catch (e) {
      console.error("Error building task activity:", e);
      res.status(500).json({ error: "Failed to build task activity" });
    }
  });

  api.get("/tasks/:taskId/events", (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (ev: { ts: number; type: string; data: unknown }) => {
      try {
        const summary = summarizeEvent(ev);
        const payload = { ...ev, summary };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // client likely disconnected; cleanup happens on req.close
      }
    };

    // Replay buffered events first so a late subscriber sees the full thread
    for (const ev of getTaskEvents(taskId)) send(ev);

    // Subscribe to live events
    const unsubscribe = subscribeToTaskEvents(taskId, send);

    // Heartbeat to keep proxies / browsers from closing the connection
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { /* ignore */ }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Stop / cancel endpoints
  api.post("/orchestrator/abort", async (_req: Request, res: Response) => {
    try {
      const aborted = await abortOrchestrator();
      res.json({ aborted });
    } catch (e) {
      console.error("Error aborting orchestrator:", e);
      res.status(500).json({ error: "Failed to abort orchestrator" });
    }
  });

  api.post("/tasks/:taskId/cancel", async (req: Request, res: Response) => {
    try {
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      const cancelled = await cancelAgentTask(taskId);
      if (!cancelled) {
        res.status(404).json({ error: "Task not found or not running" });
        return;
      }
      res.json({ cancelled: true });
    } catch (e) {
      console.error("Error cancelling task:", e);
      res.status(500).json({ error: "Failed to cancel task" });
    }
  });

  // Schedules endpoints
  api.get("/schedules", (_req: Request, res: Response) => {
    try {
      const io = listIoSchedules();
      const squads = listSchedules();
      res.json({ io, squads });
    } catch (e) {
      console.error("Error listing schedules:", e);
      res.status(500).json({ error: "Failed to list schedules" });
    }
  });

  // Squad schedule lifecycle
  api.post("/schedules/squads/:id/pause", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = setScheduleEnabled(id, false);
      if (!ok) { res.status(404).json({ error: "Squad schedule not found" }); return; }
      res.json({ ok: true, schedule: getSchedule(id) });
    } catch (e) {
      console.error("Error pausing squad schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.post("/schedules/squads/:id/resume", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = setScheduleEnabled(id, true);
      if (!ok) { res.status(404).json({ error: "Squad schedule not found" }); return; }
      res.json({ ok: true, schedule: getSchedule(id) });
    } catch (e) {
      console.error("Error resuming squad schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.post("/schedules/squads/:id/run-now", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const result = await runScheduleNow(id);
      if (!result.ok) { res.status(404).json({ error: result.error ?? "Squad schedule not found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error running squad schedule now:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.delete("/schedules/squads/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = deleteSchedule(id);
      if (!ok) { res.status(404).json({ error: "Squad schedule not found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error deleting squad schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  // IO schedule lifecycle
  api.post("/schedules/io/:id/pause", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = setIoScheduleEnabled(id, false);
      if (!ok) { res.status(404).json({ error: "IO schedule not found" }); return; }
      res.json({ ok: true, schedule: getIoSchedule(id) });
    } catch (e) {
      console.error("Error pausing IO schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.post("/schedules/io/:id/resume", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = setIoScheduleEnabled(id, true);
      if (!ok) { res.status(404).json({ error: "IO schedule not found" }); return; }
      res.json({ ok: true, schedule: getIoSchedule(id) });
    } catch (e) {
      console.error("Error resuming IO schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.post("/schedules/io/:id/run-now", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = await runIoScheduleNow(id);
      if (!ok) { res.status(404).json({ error: "IO schedule not found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error running IO schedule now:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  api.delete("/schedules/io/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    try {
      const ok = deleteIoSchedule(id);
      if (!ok) { res.status(404).json({ error: "IO schedule not found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error deleting IO schedule:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  // Schedule run history (issue #65)
  api.get("/schedules/:type/:id/runs", (req: Request, res: Response) => {
    const rawType = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
    const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid schedule id" }); return; }
    const scheduleTypeMap: Record<string, string> = { squads: "squad", io: "io" };
    const scheduleType = scheduleTypeMap[rawType];
    if (!scheduleType) { res.status(400).json({ error: "type must be 'squads' or 'io'" }); return; }
    const rawLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isNaN(rawLimit) ? 25 : Math.min(rawLimit, 100);
    try {
      const runs = getScheduleRuns(scheduleType, id, limit);
      res.json({ runs });
    } catch (e) {
      console.error("Error fetching schedule runs:", e);
      res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
    }
  });

  // Notifications endpoints
  api.get("/notifications", (_req: Request, res: Response) => {
    try {
      const unreadOnly = _req.query.unread === "true";
      const rows = unreadOnly
        ? listUnreadNotifications()
        : (() => {
            const rawLimit = _req.query.limit;
            const parsed = typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : NaN;
            const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
            return listRecentNotifications(limit);
          })();
      const unreadCount = countUnreadNotifications();
      const notifications = rows.map(({ id, title, text, created_at, read_at, source_type, source_ref }) => {
        let source: { type: string; [key: string]: unknown } = { type: source_type };
        if (source_ref) {
          try {
            const parsed = JSON.parse(source_ref) as Record<string, unknown>;
            source = { type: source_type, ...parsed };
          } catch {
            // source_ref is not valid JSON — fall back to type-only
          }
        }
        return { id, title, text, created_at, read_at, source };
      });
      res.json({ notifications, unreadCount });
    } catch (e) {
      console.error("Error listing notifications:", e);
      res.status(500).json({ error: "Failed to list notifications" });
    }
  });

  api.post("/notifications/read-all", (_req: Request, res: Response) => {
    try {
      const marked = markAllNotificationsRead();
      res.json({ marked });
    } catch (e) {
      console.error("Error marking all notifications read:", e);
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  api.post("/notifications/:id/read", (req: Request, res: Response) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "invalid id" });
        return;
      }
      const found = markNotificationRead(id);
      if (!found) {
        res.status(404).json({ error: "notification not found" });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error marking notification read:", e);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  // Chat endpoints
  api.post("/message", async (req: Request, res: Response) => {
    const { text } = req.body as { text?: string };

    if (!text) {
      res.status(400).json({ error: "Missing 'text' in request body" });
      return;
    }

    if (!messageHandler) {
      res.status(503).json({ error: "No message handler registered" });
      return;
    }

    const connectionId = crypto.randomUUID();
    let fullResponse = "";

    await messageHandler(text, connectionId, (chunk, done) => {
      fullResponse += chunk;

      const ssePayload = JSON.stringify({
        type: done ? "done" : "delta",
        text: chunk,
      });
      for (const conn of sseConnections) {
        conn.write(`data: ${ssePayload}\n\n`);
      }
    });

    res.json({ response: fullResponse });
  });

  api.get("/events", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseConnections.add(res);

    req.on("close", () => {
      sseConnections.delete(res);
    });
  });

  // Wiki endpoints (issue #105)
  function extractWikiTitle(pageContent: string, fallback: string): string {
    const match = pageContent.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : fallback;
  }

  api.get("/wiki", (_req: Request, res: Response) => {
    try {
      const pages = listPages();
      const result = pages.map((pagePath) => {
        const pageContent = readPage(pagePath);
        const title = pageContent ? extractWikiTitle(pageContent, pagePath) : pagePath;
        return { path: pagePath, title };
      });
      res.json({ pages: result });
    } catch (e) {
      console.error("Error listing wiki pages:", e);
      res.status(500).json({ error: "Failed to list wiki pages" });
    }
  });

  api.get("/wiki/*path", (req: Request, res: Response) => {
    try {
      const pagePath = Array.isArray(req.params.path) ? req.params.path[0] : req.params.path;
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
    } catch (e) {
      console.error("Error reading wiki page:", e);
      res.status(500).json({ error: "Failed to read wiki page" });
    }
  });

  // Mount API at /api (for frontend)
  app.use("/api", api);

  // Serve Vue frontend if built assets exist (before backward-compat API mount)
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    console.log("[io] Web frontend enabled");
  }

  // SPA fallback for browser navigation: when the web frontend is built,
  // serve index.html for any GET request that accepts HTML and isn't an API
  // call. This lets vue-router handle client-side routes like /chat, /skills,
  // /squads, etc. on direct URL access and page refresh. Programmatic clients
  // (curl, fetch without Accept: text/html) fall through to the backward-compat
  // API mount below.
  if (existsSync(WEB_DIST)) {
    app.get(/.*/, (req: Request, res: Response, next) => {
      if (req.path.startsWith("/api/")) return next();
      const accept = req.headers.accept ?? "";
      if (!accept.includes("text/html")) return next();
      res.sendFile(path.join(WEB_DIST, "index.html"));
    });
  }

  // Backward-compat: mount API at / for non-browser clients (after static files
  // and SPA fallback so frontend routes are not intercepted).
  app.use("/", api);

  return new Promise<void>((resolve) => {
    app.listen(config.port, () => {
      console.log(`[io] Server listening on port ${config.port}`);
      resolve();
    });
  });
}
