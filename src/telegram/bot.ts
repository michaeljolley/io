import { Bot, type Context } from "grammy";
import type { Config } from "../config.js";
import { handleMessage } from "./handlers.js";

let bot: Bot | undefined;

export async function startBot(config: Config): Promise<void> {
  if (!config.telegramBotToken) {
    throw new Error("Telegram bot token not configured.");
  }

  bot = new Bot(config.telegramBotToken);

  // Only allow the authorized user
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== config.authorizedUserId) {
      await ctx.reply("Unauthorized.");
      return;
    }
    await next();
  });

  bot.on("message:text", async (ctx) => {
    await handleMessage(ctx, ctx.message.text);
  });

  bot.on("message:photo", async (ctx) => {
    await handleMessage(ctx, "[Image attached]", true);
  });

  bot.on("message:document", async (ctx) => {
    const caption = ctx.message.caption ?? "[Document attached]";
    await handleMessage(ctx, caption, true);
  });

  bot.catch((err) => {
    console.error("[telegram] Bot error:", err.message);
  });

  bot.start();
}

export function getBot(): Bot | undefined {
  return bot;
}

export async function stopBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = undefined;
  }
}
