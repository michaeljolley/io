import { EVENT_NAMES } from "@io/shared";

import type { Config } from "../config.js";
import type { TelegramBot } from "./bot.js";

export class TelegramNotifier {
	private readonly bot: TelegramBot;
	private readonly config: Config;
	private readonly eventBus: any;
	private readonly queue: string[] = [];
	private timer: NodeJS.Timeout | null = null;
	private nextAvailableAt = 0;

	constructor(bot: TelegramBot, config: Config, eventBus: any) {
		this.bot = bot;
		this.config = config;
		this.eventBus = eventBus;
		this.subscribe();
	}

	private subscribe(): void {
		this.eventBus.on(EVENT_NAMES.INBOX_NEW_ITEM, (payload: any) => {
			this.enqueue(`Inbox: ${payload.item.title}\n\n${payload.item.content}`);
		});
		this.eventBus.on(EVENT_NAMES.QA_ESCALATED, (payload: any) => {
			this.enqueue(`QA escalated objective ${payload.objectiveId}.\n\n${payload.reason}`);
		});
		this.eventBus.on(EVENT_NAMES.OBJECTIVE_COMPLETED, (payload: any) => {
			this.enqueue(
				`Objective completed: ${payload.objective.id}\n${payload.objective.description}`,
			);
		});
		this.eventBus.on(EVENT_NAMES.OBJECTIVE_FAILED, (payload: any) => {
			this.enqueue(`Objective failed: ${payload.objective.id}\n${payload.reason}`);
		});
	}

	private enqueue(message: string): void {
		if (!this.config.telegramUserId) {
			return;
		}
		this.queue.push(message);
		this.scheduleDrain();
	}

	private scheduleDrain(): void {
		if (this.timer) {
			return;
		}
		const delay = Math.max(this.nextAvailableAt - Date.now(), 0);
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flushNext();
		}, delay);
	}

	private async flushNext(): Promise<void> {
		if (!this.config.telegramUserId) {
			this.queue.length = 0;
			return;
		}
		const message = this.queue.shift();
		if (!message) {
			return;
		}
		await this.bot.sendText(this.config.telegramUserId, message);
		this.nextAvailableAt = Date.now() + 3_000;
		if (this.queue.length > 0) {
			this.scheduleDrain();
		}
	}
}

export function createTelegramNotifier(
	bot: TelegramBot | null,
	config: Config,
	eventBus: any,
): TelegramNotifier | null {
	if (!bot || !config.telegramUserId) {
		return null;
	}
	return new TelegramNotifier(bot, config, eventBus);
}
