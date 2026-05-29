import { loadConfig, getConfigWarning } from "./config.js";
import { getDb, closeDb } from "./store/db.js";
import { PATHS } from "./paths.js";
import { mkdirSync, existsSync } from "node:fs";

export interface DaemonOptions {
  selfEdit: boolean;
}

export async function startDaemon(opts: DaemonOptions): Promise<void> {
  console.log("[io] Starting daemon...");

  // Ensure directories exist
  for (const dir of [PATHS.home, PATHS.wiki, PATHS.wikiPages, PATHS.skills, PATHS.sessions]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const config = loadConfig();

  // Initialize database
  const db = getDb();
  console.log("[io] Database initialized.");

  // Initialize Copilot client & orchestrator
  const { getClient } = await import("./copilot/client.js");
  const client = await getClient();
  console.log("[io] Copilot client connected.");

  const { initOrchestrator } = await import("./copilot/orchestrator.js");
  await initOrchestrator(client, { selfEdit: opts.selfEdit });
  console.log("[io] Orchestrator session ready.");

  // Start HTTP API server
  const { startApiServer } = await import("./api/server.js");
  await startApiServer(config);
  console.log(`[io] API server listening on port ${config.port}.`);

  // Start Telegram bot (if configured)
  if (config.telegramEnabled && config.telegramBotToken) {
    const { startBot } = await import("./telegram/bot.js");
    await startBot(config);
    console.log("[io] Telegram bot started.");
  }

  // Start schedulers
  const { startSquadScheduler } = await import("./copilot/scheduler.js");
  const { startIoScheduler } = await import("./copilot/io-scheduler.js");
  startSquadScheduler();
  startIoScheduler();
  console.log("[io] Schedulers active.");

  // Start watchdog
  if (config.watchdogEnabled) {
    const { startWatchdog } = await import("./watchdog.js");
    startWatchdog();
    console.log("[io] Watchdog active.");
  }

  console.log("[io] Daemon running. Press Ctrl+C to stop.");

  // Notify user if config had to fall back to defaults
  const configWarn = getConfigWarning();
  if (configWarn) {
    const { postFeedItem } = await import("./store/feed.js");
    postFeedItem("system", "⚠️ Config Warning", configWarn);
  }

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      console.log("[io] Forcing exit...");
      process.exit(1);
    }
    shuttingDown = true;
    console.log("\n[io] Shutting down...");
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
