#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("io")
  .description("IO — a personal AI assistant daemon")
  .version(pkg.version);

program
  .command("daemon", { isDefault: true })
  .description("Run IO as a background daemon (Telegram + HTTP API)")
  .option("--self-edit", "Allow IO to modify its own source code")
  .action(async (opts) => {
    const { startDaemon } = await import("./daemon.js");
    await startDaemon({ selfEdit: opts.selfEdit ?? false });
  });

program
  .command("setup")
  .description("Configure IO (Telegram, Supabase, etc.)")
  .action(async () => {
    const { runSetup } = await import("./setup.js");
    await runSetup();
  });

program.parse();
