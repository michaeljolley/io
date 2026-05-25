import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import express, { type Request, type Response } from "express";
import { config } from "../config.js";
import { listSkills, installSkill, installSkillFromContent, removeSkill } from "../copilot/skills.js";
import { loadMcpConfig, saveMcpConfig } from "../mcp/config.js";
import { initMcpTools } from "../copilot/orchestrator.js";
import { listSquads, createSquad, listSquadAgents, getSquad } from "../store/squads.js";
import { createInstance, getInstance, listInstances, updateInstanceStatus, getInstanceDecisions, mergeInstanceDecisions, buildContextSnapshot } from "../store/instances.js";
import { createWorktree, removeWorktree } from "../store/worktrees.js";
import { getAgentInfo, cancelAgentTask, getTaskEvents, subscribeToTaskEvents } from "../copilot/agents.js";
import { summarize, summarizeEvent } from "../copilot/event-summary.js";
import { abortOrchestrator } from "../copilot/orchestrator.js";
import { getActiveTasks, getTask, listRecentTasks } from "../store/tasks.js";
import { IO_VERSION, SKILLS_DIR } from "../paths.js";
import { requireAuth } from "./auth.js";
import { listSchedules, getSchedule, deleteSchedule, setScheduleEnabled } from "../store/schedules.js";
import { listIoSchedules, getIoSchedule, deleteIoSchedule, setIoScheduleEnabled } from "../store/io-schedules.js";
import { getScheduleRuns } from "../store/schedule-runs.js";
import { createFeedEntry, listFeedEntries, listFeedSquads, countUnreadFeedEntries, markFeedEntryRead, markAllFeedEntriesRead, deleteFeedEntry, markFeedEntriesRead, deleteFeedEntries, type FeedEntryType } from "../store/feed.js";

import { listPages, readPage } from "../wiki/fs.js";
import { runScheduleNow } from "../copilot/scheduler.js";
import { runIoScheduleNow } from "../copilot/io-scheduler.js";


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
  const data = JSON.stringify({ type: "feed", ...payload });
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
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

  // Apply auth middleware — all routes below require a valid JWT
  api.use(requireAuth);

  // Skills read endpoints
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

  // Feed endpoints — unified deliverables + notifications feed
  api.get("/feed/count", (req: Request, res: Response) => {
    try {
      const rawType = req.query.type;
      const type = rawType === "inbox" || rawType === "notification"
        ? (rawType as FeedEntryType)
        : undefined;
      const count = countUnreadFeedEntries(type);
      res.json({ count });
    } catch (e) {
      console.error("Error counting feed entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.get("/feed", (req: Request, res: Response) => {
    try {
      const rawType = req.query.type;
      const type = rawType === "inbox" || rawType === "notification"
        ? (rawType as FeedEntryType)
        : undefined;
      const unreadOnly = req.query.unread === "true";
      const rawLimit = req.query.limit;
      const parsed = typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : NaN;
      const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
      const search = typeof req.query.search === "string" && req.query.search !== "" ? req.query.search : undefined;
      const squad = typeof req.query.squad === "string" && req.query.squad !== "" ? req.query.squad : undefined;
      const rows = listFeedEntries({ type, unreadOnly, limit, search, squad });
      const unreadCount = countUnreadFeedEntries(type);
      const entries = rows.map(({ id, type: entryType, title, body, created_at, read_at, source_type, source_ref }) => {
        let source: { type: string; [key: string]: unknown } | null = null;
        if (source_type) {
          source = { type: source_type };
          if (source_ref) {
            try {
              const parsedRef = JSON.parse(source_ref) as Record<string, unknown>;
              source = { type: source_type, ...parsedRef };
            } catch {
              // source_ref is not valid JSON — fall back to type-only
            }
          }
        }
        return { id, type: entryType, title, body, created_at, read_at, source };
      });
      res.json({ entries, unreadCount });
    } catch (e) {
      console.error("Error listing feed entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.get("/feed/squads", (req: Request, res: Response) => {
    try {
      const squads = listFeedSquads();
      res.json({ squads });
    } catch (e) {
      console.error("Error listing feed squads:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Status endpoint
  api.get("/status", (_req: Request, res: Response) => {
    res.json({ version: IO_VERSION, uptime: process.uptime() });
  });


  // SSE events endpoint
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

  // Install a skill from pasted SKILL.md content (issue #117)
  api.post("/skills/paste", (req: Request, res: Response) => {
    const { content: skillContent, slug } = req.body as { content?: unknown; slug?: unknown };
    if (!skillContent || typeof skillContent !== "string" || skillContent.trim() === "") {
      res.status(400).json({ error: "Missing or empty required field: content" });
      return;
    }
    if (!slug || typeof slug !== "string" || slug.trim() === "") {
      res.status(400).json({ error: "Missing or empty required field: slug" });
      return;
    }
    try {
      const skill = installSkillFromContent(skillContent, slug.trim());
      res.status(201).json({ skill });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
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
      const result = await installSkill(trimmed);
      const skills = Array.isArray(result) ? result : [result];
      res.status(201).json({ skill: skills[0], skills });
    } catch (e) {
      console.error("Error installing skill:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Delete an installed skill by slug (issue #140)
  api.delete("/skills/:slug", (req: Request, res: Response) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
      res.status(400).json({ error: "Invalid skill slug" });
      return;
    }
    try {
      const deleted = removeSkill(slug);
      if (!deleted) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }
      res.json({ deleted: true });
    } catch (e) {
      console.error("Error deleting skill:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Feed write endpoints
  // Note: POST /feed/read-all must be before POST /feed/:id/read to avoid route shadowing
  api.post("/feed/read-all", (req: Request, res: Response) => {
    try {
      const rawType = req.query.type;
      const type = rawType === "inbox" || rawType === "notification"
        ? (rawType as FeedEntryType)
        : undefined;
      const marked = markAllFeedEntriesRead(type);
      res.json({ marked });
    } catch (e) {
      console.error("Error marking feed entries read:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/feed/batch-read", (req: Request, res: Response) => {
    const { ids } = req.body as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "number")) {
      res.status(400).json({ error: "ids must be a non-empty array of numbers" });
      return;
    }
    try {
      const marked = markFeedEntriesRead(ids as number[]);
      res.json({ marked });
    } catch (e) {
      console.error("Error batch-marking feed entries read:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/feed/batch-delete", (req: Request, res: Response) => {
    const { ids } = req.body as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "number")) {
      res.status(400).json({ error: "ids must be a non-empty array of numbers" });
      return;
    }
    try {
      const deleted = deleteFeedEntries(ids as number[]);
      res.json({ deleted });
    } catch (e) {
      console.error("Error batch-deleting feed entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/feed/:id/read", (req: Request, res: Response) => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(raw, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const found = markFeedEntryRead(id);
      if (!found) {
        res.status(404).json({ error: "Feed entry not found" });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("Error marking feed entry read:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/feed", (req: Request, res: Response) => {
    const { type, title, body, source_type, source_ref } = req.body as {
      type?: unknown;
      title?: unknown;
      body?: unknown;
      source_type?: unknown;
      source_ref?: unknown;
    };
    if (type !== "inbox" && type !== "notification") {
      res.status(400).json({ error: "type must be 'inbox' or 'notification'" });
      return;
    }
    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "Missing or empty required field: title" });
      return;
    }
    if (!body || typeof body !== "string" || body.trim() === "") {
      res.status(400).json({ error: "Missing or empty required field: body" });
      return;
    }
    try {
      const entry = createFeedEntry({
        type: type as FeedEntryType,
        title: title.trim(),
        body: body.trim(),
        source_type: typeof source_type === "string" ? source_type : undefined,
        source_ref: typeof source_ref === "string" ? source_ref : undefined,
      });
      res.status(201).json({ entry });
    } catch (e) {
      console.error("Error creating feed entry:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.delete("/feed/:id", (req: Request, res: Response) => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(raw, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const deleted = deleteFeedEntry(id);
      if (!deleted) {
        res.status(404).json({ error: "Feed entry not found" });
        return;
      }
      res.json({ deleted: true });
    } catch (e) {
      console.error("Error deleting feed entry:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });


  // Inbox endpoints
  api.get("/inbox/count", (_req: Request, res: Response) => {
    try {
      const count = countUnreadFeedEntries("inbox");
      res.json({ count });
    } catch (e) {
      console.error("Error counting inbox entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.get("/inbox", (_req: Request, res: Response) => {
    try {
      const entries = listFeedEntries({ type: "inbox" });
      res.json({ entries });
    } catch (e) {
      console.error("Error listing inbox entries:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.delete("/inbox/:id", (req: Request, res: Response) => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(raw, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const deleted = deleteFeedEntry(id);
      if (!deleted) {
        res.status(404).json({ error: "Inbox entry not found" });
        return;
      }
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting inbox entry:", e);
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

  // Squad Instances
  api.get("/squads/:slug/instances", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const includeCompleted = req.query.include_completed === "true";
      const instances = listInstances(slug, { includeCompleted });
      res.json({ instances });
    } catch (e) {
      console.error("Error listing instances:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/squads/:slug/instances", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const { issue_ref, base_branch } = req.body as { issue_ref?: string; base_branch?: string };
      const squad = getSquad(slug);
      if (!squad) { res.status(404).json({ error: "Squad not found" }); return; }

      const sanitizedRef = (issue_ref ?? "task").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
      const instanceId = `${slug}--${sanitizedRef}`;
      const branchName = `${slug}/instance/${sanitizedRef}`;

      const contextSnapshot = buildContextSnapshot(slug);
      const worktreePath = createWorktree(squad.project_path, instanceId, branchName, base_branch ?? "main");

      let instance;
      try {
        instance = createInstance({
          id: instanceId,
          masterSquadSlug: slug,
          issueRef: issue_ref,
          worktreePath,
          branchName,
          contextSnapshot,
        });
      } catch (createErr) {
        // Roll back the worktree if DB insert fails (e.g. max instances exceeded)
        removeWorktree(squad.project_path, worktreePath);
        throw createErr;
      }

      updateInstanceStatus(instanceId, "active");
      res.status(201).json({ instance: { ...instance, status: "active" } });
    } catch (e) {
      console.error("Error creating instance:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.get("/squads/:slug/instances/:id", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const instance = getInstance(id);
      if (!instance || instance.master_squad_slug !== slug) {
        res.status(404).json({ error: "Instance not found" }); return;
      }
      const decisions = getInstanceDecisions(id);
      res.json({ instance, decisions });
    } catch (e) {
      console.error("Error getting instance:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/squads/:slug/instances/:id/complete", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const instance = getInstance(id);
      if (!instance || instance.master_squad_slug !== slug) {
        res.status(404).json({ error: "Instance not found" }); return;
      }
      if (instance.status === "done") {
        res.json({ message: "Already completed", merged: 0 }); return;
      }

      updateInstanceStatus(id, "merging");
      const merged = mergeInstanceDecisions(id, instance.master_squad_slug);

      const squad = getSquad(instance.master_squad_slug);
      if (squad) {
        removeWorktree(squad.project_path, instance.worktree_path);
      }

      updateInstanceStatus(id, "done");
      res.json({ message: "Instance completed", merged });
    } catch (e) {
      console.error("Error completing instance:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/squads/:slug/instances/:id/abort", (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const instance = getInstance(id);
      if (!instance || instance.master_squad_slug !== slug) {
        res.status(404).json({ error: "Instance not found" }); return;
      }
      if (instance.status === "done" || instance.status === "failed") {
        res.json({ message: `Already in terminal state: ${instance.status}` }); return;
      }

      updateInstanceStatus(id, "failed");
      res.json({ message: "Instance aborted", worktree_path: instance.worktree_path });
    } catch (e) {
      console.error("Error aborting instance:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
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

  // ── MCP server management endpoints ────────────────────────────────────────

  api.get("/mcp/servers", (_req: Request, res: Response) => {
    try {
      const config = loadMcpConfig();
      res.json({ servers: config.servers });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/mcp/servers", (req: Request, res: Response) => {
    const { name, command, args, url, env } = req.body as {
      name?: string; command?: string; args?: string[]; url?: string; env?: Record<string, string>
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

  api.delete("/mcp/servers/:name", (req: Request, res: Response) => {
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

  api.patch("/mcp/servers/:name/toggle", (req: Request, res: Response) => {
    try {
      const config = loadMcpConfig();
      const server = config.servers.find(s => s.name === req.params.name);
      if (!server) { res.status(404).json({ error: "server not found" }); return; }
      server.enabled = server.enabled === false ? true : false;
      saveMcpConfig(config);
      res.json({ ok: true, enabled: server.enabled });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  api.post("/mcp/reload", async (_req: Request, res: Response) => {
    try {
      await initMcpTools();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "reload failed" });
    }
  });

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
