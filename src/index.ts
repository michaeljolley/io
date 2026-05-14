#!/usr/bin/env node

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(
    `IO requires Node.js 22 or later (current: ${process.version}). Please upgrade: https://nodejs.org`
  );
  process.exit(1);
}

import { Command } from "commander";
import { startDaemon } from "./daemon.js";
import { startTui, setMessageHandler as setTuiHandler } from "./tui/index.js";
import { sendToOrchestrator, initOrchestrator } from "./copilot/orchestrator.js";
import { getClient } from "./copilot/client.js";
import { getDb, closeDb } from "./store/db.js";
import { ensureWikiStructure } from "./wiki/fs.js";
import { startApiServer, setMessageHandler as setApiHandler } from "./api/server.js";
import { listSkills, installSkill, removeSkill, searchSkillsRegistry } from "./copilot/skills.js";
import { config, saveConfig } from "./config.js";
import { createInterface } from "readline";
import { IO_VERSION } from "./paths.js";

const program = new Command();

program
  .name("io")
  .description("IO — personal AI assistant daemon")
  .version(IO_VERSION);

program
  .option("--daemon", "Run as a background daemon")
  .option("--self-edit", "Allow IO to modify its own source code")
  .action(async (opts: { daemon?: boolean; selfEdit?: boolean }) => {
    if (opts.selfEdit) {
      config.selfEditEnabled = true;
    }

    if (opts.daemon) {
      await startDaemon();
    } else {
      // TUI mode — start minimal services and launch interactive chat
      console.log("[io] Starting IO in interactive mode...");

      getDb();
      ensureWikiStructure();

      const client = await getClient();
      await initOrchestrator(client);

      // Wire up API handler for TUI bridge
      setApiHandler(async (text, connectionId, callback) => {
        await sendToOrchestrator(text, { type: "tui", connectionId }, callback);
      });
      await startApiServer();

      // Wire up TUI handler
      setTuiHandler(async (text, callback) => {
        await sendToOrchestrator(
          text,
          { type: "tui", connectionId: "tui-main" },
          callback,
        );
      });

      await startTui();
    }
  });

// Skill management commands
const skillCmd = program.command("skill").description("Manage IO skills");

skillCmd
  .command("list")
  .description("List installed skills")
  .action(() => {
    const skills = listSkills();
    if (skills.length === 0) {
      console.log("No skills installed.");
      return;
    }
    for (const s of skills) {
      console.log(`  ${s.name} (${s.slug})`);
      if (s.description) console.log(`    ${s.description}`);
    }
  });

skillCmd
  .command("add <repo-url>")
  .description("Install a skill from a git repository")
  .action(async (repoUrl: string) => {
    try {
      console.log(`Installing skill from ${repoUrl}...`);
      const result = await installSkill(repoUrl);
      const skills = Array.isArray(result) ? result : [result];
      for (const skill of skills) {
        console.log(`✓ Installed: ${skill.name} (${skill.slug})`);
      }
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

skillCmd
  .command("remove <slug>")
  .description("Remove an installed skill")
  .action((slug: string) => {
    const removed = removeSkill(slug);
    if (removed) {
      console.log(`✓ Removed: ${slug}`);
    } else {
      console.log(`Skill not found: ${slug}`);
    }
  });

skillCmd
  .command("search <query>")
  .description("Search the skills registry")
  .action(async (query: string) => {
    const results = await searchSkillsRegistry(query);
    if (results.length === 0) {
      console.log("No skills found.");
      return;
    }
    for (const r of results) {
      console.log(`  ${r.name}`);
      console.log(`    ${r.description}`);
      console.log(`    ${r.repoUrl}`);
    }
  });

// Setup command
program
  .command("setup")
  .description("Configure IO (Telegram bot token, user ID, etc.)")
  .action(async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    console.log("\n🔧 IO Setup\n");

    const token = await ask(`Telegram Bot Token${config.telegramBotToken ? " (press Enter to keep current)" : ""}: `);
    if (token.trim()) {
      config.telegramBotToken = token.trim();
    }

    const userId = await ask(`Telegram User ID${config.authorizedUserId ? ` (current: ${config.authorizedUserId})` : ""}: `);
    if (userId.trim()) {
      const parsed = parseInt(userId.trim(), 10);
      if (!isNaN(parsed)) config.authorizedUserId = parsed;
    }

    config.telegramEnabled = !!(config.telegramBotToken && config.authorizedUserId);

    saveConfig({
      telegramBotToken: config.telegramBotToken,
      authorizedUserId: config.authorizedUserId,
      telegramEnabled: config.telegramEnabled,
    });

    console.log("\n✓ Configuration saved to ~/.io/config.json");
    if (config.telegramEnabled) {
      console.log("  Telegram: enabled");
    } else {
      console.log("  Telegram: disabled (need both bot token and user ID)");
    }

    rl.close();
  });

program.parse();
