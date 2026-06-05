import type { Logger } from "pino";

import { APP_VERSION } from "@io/shared";

import { createApiServer, setChatOrchestrator } from "./api/index.js";
import { loadConfig } from "./config.js";
import { ensureDataDirectories } from "./data-dir.js";
import { eventBus } from "./event-bus.js";
import { initLogger } from "./logging/logger.js";
import { createOrchestrator } from "./orchestrator/index.js";
import { createScheduler } from "./scheduler/index.js";
import { scanSkills } from "./skills/index.js";
import { initDatabase } from "./store/db.js";
import { createTelegramBot, createTelegramNotifier } from "./telegram/index.js";

function registerShutdownHandlers(logger: Logger, onShutdown: () => Promise<void>): void {
	const handleShutdown = (signal: NodeJS.Signals) => {
		logger.info({ signal }, "Shutting down...");
		void onShutdown().finally(() => process.exit(0));
	};

	process.once("SIGINT", handleShutdown);
	process.once("SIGTERM", handleShutdown);
}

async function main(): Promise<void> {
	let logger: Logger | undefined;

	try {
		ensureDataDirectories();
		const config = loadConfig();
		logger = initLogger(config);

		logger.info(`IO Daemon v${APP_VERSION} starting...`);
		await initDatabase();
		logger.info("Database initialized");

		await scanSkills();
		logger.info("Skills scanned");

		const orchestrator = createOrchestrator(config, eventBus);
		await orchestrator.init();
		logger.info("Orchestrator initialized");

		const scheduler = createScheduler(orchestrator, eventBus);
		scheduler.start();
		logger.info("Scheduler started");

		setChatOrchestrator(orchestrator);
		const apiServer = createApiServer(config);
		const telegramBot = createTelegramBot(config, orchestrator);
		telegramBot?.start();
		createTelegramNotifier(telegramBot, config, eventBus);

		registerShutdownHandlers(logger, async () => {
			scheduler.stop();
			telegramBot?.stop();
			apiServer.server.close();
		});

		await apiServer.start();
		logger.info({ port: config.port }, "IO Daemon ready");
	} catch (error) {
		if (logger !== undefined) {
			logger.fatal({ err: error }, "Fatal error during daemon startup");
		} else {
			console.error("Fatal error during daemon startup", error);
		}

		process.exit(1);
	}
}

await main();
