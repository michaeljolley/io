import { Bot } from "grammy";

import type { Config } from "../config.js";
import { createLogger } from "../logging/logger.js";
import type { Orchestrator } from "../orchestrator/orchestrator.js";
import { listSquads } from "../store/index.js";

export class TelegramBot {
	private readonly config: Config;
	private readonly orchestrator: Orchestrator;
	private readonly logger = createLogger("telegram");
	readonly bot: Bot;
	private started = false;

	constructor(config: Config, orchestrator: Orchestrator) {
		if (!config.telegramToken) {
			throw new Error("Telegram token is required to create the Telegram bot.");
		}
		this.config = config;
		this.orchestrator = orchestrator;
		this.bot = new Bot(config.telegramToken);
	}

	start(): void {
		if (this.started) {
			return;
		}
		this.registerHandlers();
		this.bot.start().catch((error: unknown) => {
			this.logger.error({ err: error }, "Telegram polling failed");
		});
		this.started = true;
	}

	stop(): void {
		if (!this.started) {
			return;
		}
		this.bot.stop();
		this.started = false;
	}

	async sendText(chatId: string | number, text: string): Promise<void> {
		await this.bot.api.sendMessage(chatId, text);
	}

	private registerHandlers(): void {
		this.bot.command("start", async (ctx) => {
			await ctx.reply(
				"Hello from Io. Send me a message and I will route it through the daemon orchestrator.",
			);
		});

		this.bot.command("status", async (ctx) => {
			const squads = await listSquads();
			await ctx.reply(
				`Io daemon is running. Active session messages: ${this.orchestrator.getConversationCount()}. Squads: ${squads.length}.`,
			);
		});

		this.bot.command("squads", async (ctx) => {
			const squads = await listSquads();
			if (squads.length === 0) {
				await ctx.reply("No squads are currently configured.");
				return;
			}
			await ctx.reply(
				squads
					.map(
						(squad) => `- ${squad.name} (${squad.repoOwner}/${squad.repoName}) [${squad.status}]`,
					)
					.join("\n"),
			);
		});

		this.bot.on("message:text", async (ctx) => {
			const text = ctx.message.text?.trim() ?? "";
			if (!text || text.startsWith("/")) {
				return;
			}

			await ctx.replyWithChatAction("typing");
			const placeholder = await ctx.reply("Thinking…");
			let buffered = "";
			let lastSentAt = 0;
			const flush = async (force = false) => {
				if (buffered.length === 0) {
					return;
				}
				const now = Date.now();
				if (!force && now - lastSentAt < 800) {
					return;
				}
				lastSentAt = now;
				await this.bot.api
					.editMessageText(ctx.chat.id, placeholder.message_id, buffered)
					.catch(() => undefined);
			};

			try {
				const result = await this.orchestrator.streamMessage(
					text,
					undefined,
					"telegram",
					(chunk) => {
						if (chunk.type !== "text") {
							return;
						}
						buffered += chunk.content;
						void flush(false);
					},
				);
				buffered = result.response;
				await flush(true);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				await this.bot.api
					.editMessageText(
						ctx.chat.id,
						placeholder.message_id,
						`Telegram request failed: ${message}`,
					)
					.catch(() => undefined);
			}
		});
	}
}

export function createTelegramBot(config: Config, orchestrator: Orchestrator): TelegramBot | null {
	if (!config.telegramToken) {
		return null;
	}
	return new TelegramBot(config, orchestrator);
}
