import { createInterface } from "node:readline";
import { loadConfig, saveConfig } from "./config.js";
import { PATHS } from "./paths.js";
import { mkdirSync, existsSync } from "node:fs";

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log("\n🤖 IO Setup\n");

  if (!existsSync(PATHS.home)) mkdirSync(PATHS.home, { recursive: true });

  const config = loadConfig();

  // Supabase (required for API auth)
  console.log("— Supabase Auth (required for web/API access) —");
  const supabaseUrl = await ask(`Supabase URL [${config.supabaseUrl ?? ""}]: `);
  const supabaseAnonKey = await ask(`Supabase Anon Key [${config.supabaseAnonKey ? "****" : ""}]: `);
  const authorizedEmail = await ask(`Authorized Email [${config.authorizedEmail ?? ""}]: `);

  // Telegram (optional)
  console.log("\n— Telegram Bot (optional) —");
  const telegramBotToken = await ask(`Bot Token [${config.telegramBotToken ? "****" : ""}]: `);
  const authorizedUserId = await ask(`Your Telegram User ID [${config.authorizedUserId ?? ""}]: `);
  const telegramEnabled = await ask(`Enable Telegram? (y/n) [${config.telegramEnabled ? "y" : "n"}]: `);

  saveConfig({
    supabaseUrl: supabaseUrl || config.supabaseUrl,
    supabaseAnonKey: supabaseAnonKey || config.supabaseAnonKey,
    authorizedEmail: authorizedEmail || config.authorizedEmail,
    telegramBotToken: telegramBotToken || config.telegramBotToken,
    authorizedUserId: authorizedUserId
      ? parseInt(authorizedUserId, 10)
      : config.authorizedUserId,
    telegramEnabled:
      telegramEnabled === "y" ? true : telegramEnabled === "n" ? false : config.telegramEnabled,
  });

  console.log(`\n✅ Configuration saved to ${PATHS.config}\n`);
  rl.close();
}
