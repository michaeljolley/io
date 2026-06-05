import { join } from "node:path";

import { APP_NAME } from "@io/shared";
import { LOGS_DIR } from "@io/shared/paths";
import pino, { multistream, type DestinationStream, type Logger } from "pino";
import pretty from "pino-pretty";

import type { Config } from "../config.js";

const LOG_FILE_PATH = join(LOGS_DIR, "io.log");
const SUBSYSTEM_NAMES = [
	"orchestrator",
	"squad",
	"api",
	"scheduler",
	"wiki",
	"skills",
	"telegram",
	"execution",
] as const;

type SubsystemName = (typeof SUBSYSTEM_NAMES)[number];

let rootLogger: Logger | null = null;

function shouldPrettyPrint(logLevel: Config["logLevel"]): boolean {
	return (
		process.env.NODE_ENV !== "production" ||
		process.env.LOG_LEVEL === "debug" ||
		logLevel === "debug" ||
		logLevel === "trace"
	);
}

function createConsoleStream(logLevel: Config["logLevel"]): DestinationStream {
	if (!shouldPrettyPrint(logLevel)) {
		return pino.destination({ dest: 1, sync: false });
	}

	return pretty({
		colorize: true,
		translateTime: "SYS:standard",
		ignore: "pid,hostname",
		singleLine: false,
	}) as unknown as DestinationStream;
}

function getRootLogger(): Logger {
	if (rootLogger === null) {
		rootLogger = pino({
			name: APP_NAME,
			level: "info",
		});
	}

	return rootLogger;
}

export function initLogger(config: Config): Logger {
	const consoleStream = createConsoleStream(config.logLevel);
	const fileStream = pino.destination({ dest: LOG_FILE_PATH, sync: false });

	rootLogger = pino(
		{
			name: APP_NAME,
			level: config.logLevel,
		},
		multistream([{ stream: consoleStream }, { stream: fileStream }]),
	);

	return rootLogger;
}

export function createLogger(name: SubsystemName): Logger {
	return getRootLogger().child({ subsystem: name });
}

export { SUBSYSTEM_NAMES };
