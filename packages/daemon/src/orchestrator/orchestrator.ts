import type { EventEmitter } from "node:events";
import type { CopilotSession } from "@github/copilot-sdk";
import {
	type Conversation,
	DEFAULT_MODEL,
	EVENT_NAMES,
	type Message,
	type StreamChunk,
} from "@io/shared";

import type { Config } from "../config.js";
import {
	type ResetMessage,
	buildFreshSessionContext,
	createResetSummary,
	shouldReset,
} from "../copilot/reset.js";
import { type UsageData, createSession, sendMessage } from "../copilot/session.js";
import { createLogger } from "../logging/logger.js";
import { calculateTokenUnitCost, getModelPricing } from "../models/registry.js";
import {
	type Skill,
	getActiveSkillsContext,
	getSkillsForActivation,
	scanSkills,
} from "../skills/index.js";
import {
	appendMessage,
	createConversation,
	getConversation,
	listSquads,
	recordUsage,
} from "../store/index.js";
import { writeEpisode } from "../wiki/episodes.js";
import { getRecentPages, searchPages } from "../wiki/search.js";

import { buildSystemPrompt } from "./system-prompt.js";
import { createBoundOrchestratorTools } from "./tools/index.js";

export interface ProcessMessageResult {
	response: string;
	conversationId: string;
	conversation: Conversation;
	userMessage: Message;
	assistantMessage: Message;
}

export type ChunkHandler = (chunk: StreamChunk) => void;

export class Orchestrator {
	private readonly config: Config;
	private readonly eventBus: EventEmitter;
	private readonly logger = createLogger("orchestrator");
	private activeSession: CopilotSession | null = null;
	private activeModel: string | null = null;
	private sessionMessageCount = 0;
	private sessionMessages: ResetMessage[] = [];
	private latestResetSummary = "";
	private skills: Skill[] = [];

	constructor(config: Config, eventBus: EventEmitter) {
		this.config = config;
		this.eventBus = eventBus;
	}

	async init(): Promise<void> {
		await this.refreshSkills();
		await listSquads();
		await this.refreshSession(
			this.config.defaultModel,
			buildSystemPrompt({
				squads: await listSquads(),
				wikiContext: "",
				skillsContext: getActiveSkillsContext(this.skills),
				conversationSummary: this.latestResetSummary,
			}),
		);
	}

	async processMessage(
		message: string,
		conversationId?: string,
		source?: string,
	): Promise<ProcessMessageResult> {
		return this.runMessage(message, conversationId, source, undefined);
	}

	async streamMessage(
		message: string,
		conversationId?: string,
		source?: string,
		onChunk?: ChunkHandler,
	): Promise<ProcessMessageResult> {
		return this.runMessage(message, conversationId, source, onChunk);
	}

	async resetSession(): Promise<void> {
		const summary = createResetSummary(this.sessionMessages);
		await writeEpisode(new Date(), summary);
		this.latestResetSummary = summary;
		this.sessionMessages = [];
		this.sessionMessageCount = 0;
		await this.disconnectSession();
		await this.refreshSession(
			this.config.defaultModel,
			buildSystemPrompt({
				squads: await listSquads(),
				wikiContext: "",
				skillsContext: getActiveSkillsContext(this.skills),
				conversationSummary: buildFreshSessionContext(summary, ""),
			}),
		);
	}

	getConversationCount(): number {
		return this.sessionMessageCount;
	}

	private async runMessage(
		message: string,
		conversationId: string | undefined,
		source: string | undefined,
		onChunk: ChunkHandler | undefined,
	): Promise<ProcessMessageResult> {
		const normalizedMessage = message.trim();
		if (normalizedMessage.length === 0) {
			throw new Error("Message must be a non-empty string.");
		}

		const conversation = await this.getOrCreateConversation(
			conversationId,
			normalizedMessage,
			source,
		);
		const userMessage = await appendMessage(conversation.id, "user", normalizedMessage, null);
		this.eventBus.emit(EVENT_NAMES.CHAT_MESSAGE, {
			conversationId: conversation.id,
			content: normalizedMessage,
		});

		await this.refreshSkills();
		const [squads, conversationRecord, wikiContext] = await Promise.all([
			listSquads(),
			getConversation(conversation.id),
			this.buildWikiContext(normalizedMessage),
		]);
		const skillsContext = getActiveSkillsContext(
			getSkillsForActivation(this.skills, normalizedMessage),
		);
		const conversationSummary = this.buildConversationSummary(
			conversationRecord?.messages ?? [userMessage],
		);
		const systemPrompt = buildSystemPrompt({
			squads,
			wikiContext,
			skillsContext,
			conversationSummary: [this.latestResetSummary, conversationSummary]
				.filter(Boolean)
				.join("\n\n"),
		});
		await this.refreshSession(this.config.defaultModel, systemPrompt);

		const sendResult = await sendMessage(
			this.requireActiveSession(),
			normalizedMessage,
			(content) => {
				const chunk: StreamChunk = {
					type: "text",
					content,
					conversationId: conversation.id,
				};
				onChunk?.(chunk);
				this.eventBus.emit(EVENT_NAMES.CHAT_STREAM_CHUNK, chunk);
			},
		);
		const assistantMessage = await appendMessage(
			conversation.id,
			"assistant",
			sendResult.text,
			sendResult.usage.model,
			{
				inputTokens: sendResult.usage.inputTokens,
				outputTokens: sendResult.usage.outputTokens,
			},
		);
		await this.recordUsage(sendResult.usage);

		this.sessionMessages.push(
			{ role: "user", content: normalizedMessage },
			{ role: "assistant", content: sendResult.text },
		);
		this.sessionMessageCount += 2;

		const doneChunk: StreamChunk = {
			type: "done",
			content: sendResult.text,
			conversationId: conversation.id,
			messageId: assistantMessage.id,
		};
		onChunk?.(doneChunk);
		this.eventBus.emit(EVENT_NAMES.CHAT_STREAM_END, {
			conversationId: conversation.id,
			messageId: assistantMessage.id,
		});

		if (shouldReset(this.sessionMessageCount, this.config.sessionResetThreshold)) {
			await this.resetSession();
		}

		return {
			response: sendResult.text,
			conversationId: conversation.id,
			conversation,
			userMessage,
			assistantMessage,
		};
	}

	private async getOrCreateConversation(
		conversationId: string | undefined,
		titleSource: string,
		source: string | undefined,
	): Promise<Conversation> {
		if (conversationId) {
			const existing = await getConversation(conversationId);
			if (!existing) {
				throw new Error(`Conversation ${conversationId} was not found.`);
			}
			return existing;
		}
		return createConversation(this.normalizeSource(source), titleSource.slice(0, 80));
	}

	private normalizeSource(source: string | undefined): Conversation["source"] {
		switch (source) {
			case "telegram":
			case "scheduler":
			case "web":
				return source;
			default:
				return "internal";
		}
	}

	private buildConversationSummary(messages: Message[]): string {
		return createResetSummary(
			messages.map((message) => ({ role: message.role, content: message.content })),
		);
	}

	private async buildWikiContext(message: string): Promise<string> {
		const [matches, recents] = await Promise.all([searchPages(message, 3), getRecentPages(2)]);
		const seen = new Set<string>();
		const pages = [...matches, ...recents].filter((page) => {
			if (seen.has(page.path)) {
				return false;
			}
			seen.add(page.path);
			return true;
		});
		if (pages.length === 0) {
			return "";
		}
		return pages
			.map((page) => {
				const excerpt = page.content.replace(/\s+/gu, " ").trim().slice(0, 240);
				const tags = page.tags.length > 0 ? ` tags=${page.tags.join(", ")}` : "";
				return `- ${page.title} (${page.path})${tags}: ${excerpt}`;
			})
			.join("\n");
	}

	private async refreshSkills(): Promise<void> {
		this.skills = await scanSkills();
	}

	private async refreshSession(model: string, systemPrompt: string): Promise<void> {
		await this.disconnectSession();
		try {
			this.activeSession = await createSession({
				model,
				systemPrompt,
				tools: createBoundOrchestratorTools(this.config),
			});
			this.activeModel = model;
		} catch (error) {
			// If the configured model isn't available, fall back to DEFAULT_MODEL
			if (model !== DEFAULT_MODEL) {
				this.activeSession = await createSession({
					model: DEFAULT_MODEL,
					systemPrompt,
					tools: createBoundOrchestratorTools(this.config),
				});
				this.activeModel = DEFAULT_MODEL;
			} else {
				throw error;
			}
		}
	}

	private async disconnectSession(): Promise<void> {
		if (!this.activeSession) {
			return;
		}
		await this.activeSession.disconnect().catch((error: unknown) => {
			this.logger.warn({ err: error }, "Failed to disconnect Copilot session cleanly");
		});
		this.activeSession = null;
		this.activeModel = null;
	}

	private requireActiveSession(): CopilotSession {
		if (!this.activeSession) {
			throw new Error("Copilot session is not initialized.");
		}
		return this.activeSession;
	}

	private async recordUsage(usage: UsageData): Promise<void> {
		if (usage.inputTokens === 0 && usage.outputTokens === 0) {
			return;
		}
		const model = usage.model || this.activeModel || this.config.defaultModel;
		const pricing = await getModelPricing(model);
		const cost = pricing
			? calculateTokenUnitCost(
					usage.inputTokens,
					usage.outputTokens,
					pricing.tokenInputMultiplier,
					pricing.tokenOutputMultiplier,
				)
			: 0;
		await recordUsage({
			model,
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			cost,
		});
	}
}

export function createOrchestrator(config: Config, eventBus: EventEmitter): Orchestrator {
	return new Orchestrator(config, eventBus);
}
