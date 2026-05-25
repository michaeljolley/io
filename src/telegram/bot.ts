import { Bot } from "grammy";
import { config } from "../config.js";
import type { Attachment } from "../copilot/orchestrator.js";

export type { Attachment };

const TELEGRAM_MAX_LENGTH = 4096;
const EDIT_DEBOUNCE_MS = 500;
const FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB

export type TelegramMessageHandler = (
  text: string,
  chatId: number,
  messageId: number,
  callback: (text: string, done: boolean) => void,
  attachments?: Attachment[],
) => Promise<void>;

let bot: Bot | undefined;
let messageHandler: TelegramMessageHandler | undefined;

async function downloadTelegramFile(
  botInstance: Bot,
  fileId: string,
): Promise<{ data: string; mimeType: string; size: number }> {
  const file = await botInstance.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
  return { data: buffer.toString("base64"), mimeType, size: buffer.length };
}

export function setMessageHandler(handler: TelegramMessageHandler): void {
  messageHandler = handler;
}

export function createBot(): void {
  if (!config.telegramBotToken) {
    console.error("[io] Telegram bot token not configured");
    return;
  }

  bot = new Bot(config.telegramBotToken);

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;

    if (config.authorizedUserId && userId !== config.authorizedUserId) {
      return;
    }

    if (!messageHandler) {
      console.error("[io] No message handler registered");
      return;
    }

    const text = ctx.message.text;
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;

    await ctx.replyWithChatAction("typing");

    const placeholder = await ctx.reply("…");
    let accumulated = "";
    let lastEditTime = 0;
    let pendingEdit: ReturnType<typeof setTimeout> | undefined;

    const editReply = async (content: string) => {
      try {
        const truncated = content.length > TELEGRAM_MAX_LENGTH
          ? content.slice(0, TELEGRAM_MAX_LENGTH - 20) + "\n\n[…truncated]"
          : content;
        await ctx.api.editMessageText(
          chatId,
          placeholder.message_id,
          truncated,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("message is not modified")) {
          console.error("[io] Failed to edit message:", message);
        }
      }
    };

    try {
      await messageHandler(text, chatId, messageId, (chunk, done) => {
        accumulated += chunk;

        if (done) {
          if (pendingEdit) {
            clearTimeout(pendingEdit);
            pendingEdit = undefined;
          }
          return;
        }

        const now = Date.now();
        const timeSinceLastEdit = now - lastEditTime;

        if (timeSinceLastEdit >= EDIT_DEBOUNCE_MS) {
          lastEditTime = now;
          void editReply(accumulated);
        } else if (!pendingEdit) {
          pendingEdit = setTimeout(() => {
            pendingEdit = undefined;
            lastEditTime = Date.now();
            void editReply(accumulated);
          }, EDIT_DEBOUNCE_MS - timeSinceLastEdit);
        }
      });

      if (pendingEdit) {
        clearTimeout(pendingEdit);
      }

      // Send final message
      if (accumulated.length > 0) {
        await editReply(accumulated);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[io] Error handling message:", message);
      await editReply("An error occurred while processing your message.");
    }
  });

  // ---------------------------------------------------------------------------
  // Photo handler
  // ---------------------------------------------------------------------------
  bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id;
    if (config.authorizedUserId && userId !== config.authorizedUserId) return;
    if (!messageHandler || !bot) {
      console.error("[io] No message handler registered");
      return;
    }

    // Telegram sends an array of sizes — last element is the highest resolution
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const caption = ctx.message.caption ?? "";

    await ctx.replyWithChatAction("typing");
    const ack = await ctx.reply("📎 Processing attachment…");

    try {
      const { data, mimeType, size } = await downloadTelegramFile(bot, photo.file_id);

      if (size > FILE_SIZE_LIMIT_BYTES) {
        await ctx.api.editMessageText(chatId, ack.message_id, "⚠️ File too large (max 5MB). Attachment not processed.");
        return;
      }

      const attachment: Attachment = { type: "blob", data, mimeType, displayName: "photo.jpg" };
      const placeholder = await ctx.reply("…");
      let accumulated = "";
      let lastEditTime = 0;
      let pendingEdit: ReturnType<typeof setTimeout> | undefined;

      const editReply = async (content: string) => {
        try {
          const truncated = content.length > TELEGRAM_MAX_LENGTH
            ? content.slice(0, TELEGRAM_MAX_LENGTH - 20) + "\n\n[…truncated]"
            : content;
          await ctx.api.editMessageText(chatId, placeholder.message_id, truncated);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("message is not modified")) {
            console.error("[io] Failed to edit message:", message);
          }
        }
      };

      await ctx.api.deleteMessage(chatId, ack.message_id);
      await messageHandler(caption, chatId, messageId, (chunk, done) => {
        accumulated += chunk;
        if (done) {
          if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = undefined; }
          return;
        }
        const now = Date.now();
        const timeSinceLastEdit = now - lastEditTime;
        if (timeSinceLastEdit >= EDIT_DEBOUNCE_MS) {
          lastEditTime = now;
          void editReply(accumulated);
        } else if (!pendingEdit) {
          pendingEdit = setTimeout(() => {
            pendingEdit = undefined;
            lastEditTime = Date.now();
            void editReply(accumulated);
          }, EDIT_DEBOUNCE_MS - timeSinceLastEdit);
        }
      }, [attachment]);

      if (pendingEdit) clearTimeout(pendingEdit);
      if (accumulated.length > 0) await editReply(accumulated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[io] Error handling photo:", message);
      await ctx.api.editMessageText(chatId, ack.message_id, "An error occurred while processing the attachment.");
    }
  });

  // ---------------------------------------------------------------------------
  // Document handler
  // ---------------------------------------------------------------------------
  bot.on("message:document", async (ctx) => {
    const userId = ctx.from?.id;
    if (config.authorizedUserId && userId !== config.authorizedUserId) return;
    if (!messageHandler || !bot) {
      console.error("[io] No message handler registered");
      return;
    }

    const doc = ctx.message.document;
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const caption = ctx.message.caption ?? "";

    // Reject oversized files before downloading (file_size may be undefined for large files)
    if (doc.file_size !== undefined && doc.file_size > FILE_SIZE_LIMIT_BYTES) {
      await ctx.reply("⚠️ File too large (max 5MB). Attachment not processed.");
      return;
    }

    await ctx.replyWithChatAction("typing");
    const ack = await ctx.reply("📎 Processing attachment…");

    try {
      const { data, mimeType, size } = await downloadTelegramFile(bot, doc.file_id);

      if (size > FILE_SIZE_LIMIT_BYTES) {
        await ctx.api.editMessageText(chatId, ack.message_id, "⚠️ File too large (max 5MB). Attachment not processed.");
        return;
      }

      const attachment: Attachment = {
        type: "blob",
        data,
        mimeType,
        displayName: doc.file_name ?? "document",
      };
      const placeholder = await ctx.reply("…");
      let accumulated = "";
      let lastEditTime = 0;
      let pendingEdit: ReturnType<typeof setTimeout> | undefined;

      const editReply = async (content: string) => {
        try {
          const truncated = content.length > TELEGRAM_MAX_LENGTH
            ? content.slice(0, TELEGRAM_MAX_LENGTH - 20) + "\n\n[…truncated]"
            : content;
          await ctx.api.editMessageText(chatId, placeholder.message_id, truncated);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("message is not modified")) {
            console.error("[io] Failed to edit message:", message);
          }
        }
      };

      await ctx.api.deleteMessage(chatId, ack.message_id);
      await messageHandler(caption, chatId, messageId, (chunk, done) => {
        accumulated += chunk;
        if (done) {
          if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = undefined; }
          return;
        }
        const now = Date.now();
        const timeSinceLastEdit = now - lastEditTime;
        if (timeSinceLastEdit >= EDIT_DEBOUNCE_MS) {
          lastEditTime = now;
          void editReply(accumulated);
        } else if (!pendingEdit) {
          pendingEdit = setTimeout(() => {
            pendingEdit = undefined;
            lastEditTime = Date.now();
            void editReply(accumulated);
          }, EDIT_DEBOUNCE_MS - timeSinceLastEdit);
        }
      }, [attachment]);

      if (pendingEdit) clearTimeout(pendingEdit);
      if (accumulated.length > 0) await editReply(accumulated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[io] Error handling document:", message);
      await ctx.api.editMessageText(chatId, ack.message_id, "An error occurred while processing the attachment.");
    }
  });

  bot.catch((err) => {
    console.error("[io] Grammy bot error:", err.message);
  });

  console.log("[io] Telegram bot created");
}

export async function startBot(): Promise<void> {
  if (!bot) {
    console.error("[io] Bot not created — call createBot() first");
    return;
  }

  try {
    console.log("[io] Starting Telegram bot polling…");
    void bot.start({
      onStart: () => console.log("[io] Telegram bot polling started"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[io] Failed to start Telegram bot:", message);
  }
}

export async function stopBot(): Promise<void> {
  if (!bot) {
    return;
  }

  try {
    await bot.stop();
    console.log("[io] Telegram bot stopped");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[io] Error stopping Telegram bot:", message);
  }
}

export async function sendProactiveMessage(text: string): Promise<void> {
  if (!bot) {
    console.error("[io] Bot not created — cannot send proactive message");
    return;
  }

  if (!config.authorizedUserId) {
    console.error("[io] No authorized user ID configured");
    return;
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, TELEGRAM_MAX_LENGTH));
    remaining = remaining.slice(TELEGRAM_MAX_LENGTH);
  }

  for (const chunk of chunks) {
    try {
      await bot.api.sendMessage(config.authorizedUserId, chunk);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[io] Failed to send proactive message:", message);
    }
  }
}

/**
 * Send a background schedule result as a Telegram notification.
 * Delegates to sendProactiveMessage for chunking, bot-not-configured guards,
 * and authorized-user checks — no extra logic needed here.
 *
 * Format (plain text, no parse_mode):
 *   🔔 Background update — <title>
 *
 *   <text>
 */
export async function sendBackgroundNotification(opts: {
  title: string;
  text: string;
}): Promise<void> {
  const formatted = `\ud83d\udd14 Background update \u2014 ${opts.title}\n\n${opts.text}`;
  await sendProactiveMessage(formatted);
}
