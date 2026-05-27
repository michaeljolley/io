import type { Context } from "grammy";
import { sendToOrchestrator } from "../copilot/orchestrator.js";

export async function handleMessage(
  ctx: Context,
  text: string,
  _hasAttachment?: boolean
): Promise<void> {
  // Send typing indicator
  await ctx.replyWithChatAction("typing");

  let lastSent = "";
  let replyMsgId: number | undefined;

  await sendToOrchestrator(text, "telegram", async (content, done) => {
    if (!done) return; // Only send final message for Telegram

    // Truncate if too long for Telegram (4096 char limit)
    const truncated =
      content.length > 4000 ? content.slice(0, 4000) + "\n\n...(truncated)" : content;

    if (truncated === lastSent) return;
    lastSent = truncated;

    try {
      if (replyMsgId) {
        await ctx.api.editMessageText(ctx.chat!.id, replyMsgId, truncated, {
          parse_mode: "Markdown",
        });
      } else {
        const msg = await ctx.reply(truncated, { parse_mode: "Markdown" });
        replyMsgId = msg.message_id;
      }
    } catch {
      // Fallback: send without markdown parsing
      try {
        if (!replyMsgId) {
          const msg = await ctx.reply(truncated);
          replyMsgId = msg.message_id;
        }
      } catch (err) {
        console.error("[telegram] Failed to send message:", err);
      }
    }
  });
}
