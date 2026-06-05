#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { APP_VERSION } from "@io/shared";
import { CONFIG_PATH } from "@io/shared/paths";

import { ensureDataDirectories } from "./data-dir.js";

type SetupConfig = {
	port: number;
	telegramToken: string | null;
	telegramUserId: string | null;
	supabaseUrl: string | null;
	supabaseAnonKey: string | null;
};

function printHelp(): void {
	console.log(`IO v${APP_VERSION}

Usage:
  io [start]      Start the daemon
  io setup        Run interactive setup
  io --version    Print version
  io --help       Print help
`);
}

async function readExistingConfig(): Promise<Record<string, unknown>> {
	try {
		const existingConfig = await readFile(CONFIG_PATH, "utf8");
		const parsedConfig: unknown = JSON.parse(existingConfig);

		if (parsedConfig === null || typeof parsedConfig !== "object" || Array.isArray(parsedConfig)) {
			throw new Error(`Invalid config file at ${CONFIG_PATH}: expected a JSON object`);
		}

		return { ...parsedConfig };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {};
		}

		throw error;
	}
}

async function promptPort(question: (query: string) => Promise<string>): Promise<number> {
	while (true) {
		const answer = (await question("Port [7777]: ")).trim();
		const value = answer.length === 0 ? 7777 : Number.parseInt(answer, 10);

		if (Number.isInteger(value) && value > 0) {
			return value;
		}

		console.log("Please enter a positive integer.");
	}
}

function normalizeOptionalValue(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

async function runSetup(): Promise<void> {
	const readline = createInterface({ input, output });

	try {
		const port = await promptPort((query) => readline.question(query));
		const telegramToken = normalizeOptionalValue(
			await readline.question("Telegram token (optional): "),
		);
		const telegramUserId = normalizeOptionalValue(
			await readline.question("Telegram user ID (optional): "),
		);
		const supabaseUrl = normalizeOptionalValue(
			await readline.question("Supabase URL (optional): "),
		);
		const supabaseAnonKey = normalizeOptionalValue(
			await readline.question("Supabase anon key (optional): "),
		);

		const config: SetupConfig = {
			port,
			telegramToken,
			telegramUserId,
			supabaseUrl,
			supabaseAnonKey,
		};
		const existingConfig = await readExistingConfig();

		ensureDataDirectories();
		await writeFile(
			CONFIG_PATH,
			`${JSON.stringify({ ...existingConfig, ...config }, null, 2)}\n`,
			"utf8",
		);

		console.log(`Configuration saved to ${CONFIG_PATH}`);
	} finally {
		readline.close();
	}
}

async function startDaemon(): Promise<void> {
	await import("./index.js");
}

async function main(): Promise<void> {
	const [command, ...extraArgs] = process.argv.slice(2);

	if (extraArgs.length > 0) {
		console.error(`Unexpected arguments: ${extraArgs.join(" ")}`);
		printHelp();
		process.exitCode = 1;
		return;
	}

	switch (command) {
		case undefined:
		case "start":
			await startDaemon();
			return;
		case "setup":
			await runSetup();
			return;
		case "--version":
		case "-v":
			console.log(APP_VERSION);
			return;
		case "--help":
		case "-h":
			printHelp();
			return;
		default:
			console.error(`Unknown command: ${command}`);
			printHelp();
			process.exitCode = 1;
	}
}

await main();
