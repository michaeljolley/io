import { getClient, stopClient } from "./copilot/client.js";
import { initOrchestrator, sendToOrchestrator, shutdownOrchestrator } from "./copilot/orchestrator.js";
import { startApiServer, setMessageHandler as setApiHandler, broadcastToSSE, broadcastNotificationToSSE } from "./api/server.js";
import { createBot, startBot, stopBot, sendProactiveMessage, sendBackgroundNotification, setMessageHandler as setTelegramHandler } from "./telegram/bot.js";
import { setTelegramSender, setTuiSender, setSseBroadcaster } from "./notify.js";
import { pruneOldScheduleRuns } from "./store/schedule-runs.js";
import { pruneOldFeedEntries } from "./store/feed.js";
import { printBackgroundNotification } from "./tui/index.js";
import { getDb, closeDb } from "./store/db.js";
import { clearStaleTasks } from "./store/tasks.js";
import { reconcileAgentStatuses, reconcileSquadStatuses } from "./store/squads.js";
import { backfillReviewVerdicts } from "./copilot/review-backfill.js";
import { startScheduler, stopScheduler } from "./copilot/scheduler.js";
import { startIoScheduler, stopIoScheduler } from "./copilot/io-scheduler.js";
import { config } from "./config.js";
import { startWatchdog } from "./watchdog.js";
import { ensureWikiStructure } from "./wiki/fs.js";
import { autoUpdate } from "./update.js";
import { readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { SESSIONS_DIR } from "./paths.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function pruneOldSessions(): void {
  try {
    const sessionDir = join(SESSIONS_DIR, "session-state");
    let entries: string[];
    try {
      entries = readdirSync(sessionDir);
    } catch {
      return;
    }

    const cutoff = Date.now() - SEVEN_DAYS_MS;
    let pruned = 0;

    for (const entry of entries) {
      const fullPath = join(sessionDir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory() && stat.mtimeMs < cutoff) {
          rmSync(fullPath, { recursive: true, force: true });
          pruned++;
        }
      } catch { /* skip */ }
    }

    if (pruned > 0) {
      console.log(`[io] Pruned ${pruned} orphaned session folder(s)`);
    }
  } catch (err) {
    console.error("[io] Session pruning failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}

export async function startDaemon(): Promise<void> {
  console.log("[io] Starting IO daemon...");

  // Auto-update on startup — exit after update; systemd will restart us
  const updated = await autoUpdate();
  if (updated) {
    console.log("[io] Exiting for systemd restart with updated version...");
    process.exit(0);
  }

  if (config.selfEditEnabled) {
    console.log("[io] ⚠ Self-edit mode enabled");
  }

  // Initialize database
  getDb();
  console.log("[io] Database initialized");

  // Initialize wiki
  const wikiIsNew = ensureWikiStructure();
  if (wikiIsNew) {
    console.log("[io] Created wiki at ~/.io/wiki/");
  }

  // Clear stale tasks from previous run, and reset any agent/squad rows left
  // in 'working' or 'error' state — the in-memory Copilot sessions backing
  // those rows did not survive the restart, so the persisted status is lying.
  clearStaleTasks();
  const resetAgents = reconcileAgentStatuses();
  const resetSquads = reconcileSquadStatuses();
  if (resetAgents > 0 || resetSquads > 0) {
    console.log(
      `[io] Reconciled stale statuses on startup: ${resetAgents} agent(s), ${resetSquads} squad(s) → idle`,
    );
  }

  // Backfill any historical peer-review rows whose recorded verdict (approved
  // 0/1) does not match what the current parser would extract from the prose.
  // Earlier daemon builds had a brittle first-line-only parser that flipped
  // many APPROVED reviews into REJECTED (issue #50).
  try {
    const fixed = backfillReviewVerdicts();
    if (fixed > 0) {
      console.log(
        `[io] Backfilled ${fixed} peer-review verdict(s) using current parser`,
      );
    }
  } catch (err) {
    console.error(
      "[io] Review-verdict backfill failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // Prune old sessions
  pruneOldSessions();

  // Start Copilot SDK client
  console.log("[io] Starting Copilot SDK client...");
  const client = await getClient();
  console.log("[io] Copilot SDK client ready");

  // Initialize orchestrator
  console.log("[io] Creating orchestrator session...");
  await initOrchestrator(client);
  console.log("[io] Orchestrator session ready");

  // Wire up API message handler
  setApiHandler(async (text, connectionId, callback) => {
    await sendToOrchestrator(
      text,
      { type: "tui", connectionId },
      callback,
    );
  });

  // Start HTTP API
  await startApiServer();

  // Wire up Telegram handler
  if (config.telegramEnabled) {
    setTelegramHandler(async (text, chatId, messageId, callback, attachments) => {
      await sendToOrchestrator(
        text,
        { type: "telegram", chatId, messageId },
        callback,
        attachments,
      );
    });
    createBot();
    await startBot();
  } else {
    console.log("[io] Telegram not configured — skipping bot. Set telegramBotToken in ~/.io/config.json");
  }

  // Start the squad scheduler (background cron-style stand-ups).
  startScheduler();

  // Start the IO-level scheduler (squad-independent recurring tasks).
  startIoScheduler();

  // Background-notification dispatch surfaces (issue #78)
  setSseBroadcaster((p) => broadcastNotificationToSSE(p));
  setTuiSender((opts) => printBackgroundNotification(opts));
  setTelegramSender((opts) => sendBackgroundNotification(opts));

  // Daily cleanup — prune schedule runs and notifications older than 30 days
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const PRUNE_RETENTION_DAYS = 30;
  // Start event loop watchdog
  let stopWatchdog: (() => void) | undefined;
  if (config.watchdogEnabled) {
    stopWatchdog = startWatchdog();
    console.error("[io] Event loop watchdog started");
  }

  const pruneTimer = setInterval(() => {
    try {
      const runsDeleted = pruneOldScheduleRuns(PRUNE_RETENTION_DAYS);
      const notificationsDeleted = pruneOldFeedEntries(PRUNE_RETENTION_DAYS);
      if (runsDeleted > 0 || notificationsDeleted > 0) {
        console.log(`[prune] Cleaned up ${runsDeleted} schedule runs and ${notificationsDeleted} feed entries older than ${PRUNE_RETENTION_DAYS} days`);
      }
    } catch (err) {
      console.error("[prune] Error during cleanup:", err);
    }
  }, PRUNE_INTERVAL_MS);
  pruneTimer.unref();

  // Run once on startup after a brief delay
  const pruneStartup = setTimeout(() => {
    try {
      pruneOldScheduleRuns(PRUNE_RETENTION_DAYS);
      pruneOldFeedEntries(PRUNE_RETENTION_DAYS);
    } catch { /* best effort */ }
  }, 5000);
  (pruneStartup as unknown as { unref?: () => void }).unref?.();

  console.log("[io] IO is fully operational.");

  // Notify Telegram if restarting
  if (config.telegramEnabled && process.env.IO_RESTARTED === "1") {
    await sendProactiveMessage("I'm back online 🟢").catch(() => {});
    delete process.env.IO_RESTARTED;
  }
}

// Graceful shutdown
let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    console.log("\n[io] Forced exit.");
    process.exit(1);
  }
  shuttingDown = true;
  console.log("\n[io] Shutting down... (Ctrl+C again to force)");

  const forceTimer = setTimeout(() => {
    console.log("[io] Shutdown timed out — forcing exit.");
    process.exit(1);
  }, 5000);
  forceTimer.unref();

  if (config.telegramEnabled) {
    try { await stopBot(); } catch { /* best effort */ }
  }

  stopScheduler();
  stopIoScheduler();
  await shutdownOrchestrator();
  try { await stopClient(); } catch { /* best effort */ }
  closeDb();
  console.log("[io] Goodbye.");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("[io] Unhandled rejection (kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[io] Uncaught exception — shutting down:", err);
  process.exit(1);
});
