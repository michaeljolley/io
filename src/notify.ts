import { loadConfig } from "./config.js";
import { postFeedItem } from "./store/feed.js";
import { logWarn } from "./logging.js";

export type NotifyChannel = "telegram" | "web";

export async function notify(
  title: string,
  content: string,
  source: string
): Promise<void> {
  const config = loadConfig();

  // Always post to feed
  postFeedItem(source, title, content);

  // Notify via Telegram if enabled
  if (config.backgroundNotifyTelegram && config.telegramEnabled) {
    try {
      const { getBot } = await import("./telegram/bot.js");
      const bot = getBot();
      if (bot && config.authorizedUserId) {
        const msg = `📬 *${title}*\n\n${content.slice(0, 1000)}`;
        await bot.api.sendMessage(config.authorizedUserId, msg, {
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      logWarn("Telegram notification failed", { title, source }, err);
    }
  }
}
