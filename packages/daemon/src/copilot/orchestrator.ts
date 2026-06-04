import { approveAll } from '@github/copilot-sdk';
import { loadConfig, type IOConfig } from '../config.js';
import { createChildLogger } from '../logging/logger.js';
import { recordTokenUsage } from '../models/token-tracker.js';
import { getActiveSkillsContent } from '../skills/index.js';
import { listSquads } from '../squad/manager.js';
import { appendConversationMessage } from '../store/conversations.js';
import { getDatabase } from '../store/db.js';
import { getOrchestratorScopes, getPageListing } from '../wiki/index.js';
import { getClient } from './client.js';
import { buildProvider } from './provider.js';
import { createOrchestratorTools } from './tools.js';

type Session = Awaited<ReturnType<Awaited<ReturnType<typeof getClient>>['createSession']>>;

let logger: ReturnType<typeof createChildLogger>;

let session: Session | undefined;
let sessionId: string | undefined;
let currentModel: string = '';
let currentByokHash: string = '';

interface QueuedMessage {
	prompt: string;
	source?: 'tui' | 'telegram' | 'web';
	onDelta: (accumulated: string, done: boolean) => void;
	resolve: (value: string) => void;
	reject: (reason: unknown) => void;
}

const messageQueue: QueuedMessage[] = [];
let processing = false;

const SYSTEM_MESSAGE_BASE = `You are IO, an AI orchestrator daemon. You help users manage their software projects through intelligent conversation and by coordinating specialized agent squads.

## Your Capabilities
- Answer general questions directly
- Manage squads: create, monitor, and coordinate teams of AI agents for specific projects
- Delegate project-specific work to the appropriate squad's team lead
- Track token usage and costs across all squads
- Manage the inbox: squads send you deliverables and questions that need user attention

## Routing Rules
- If the user's message relates to a project that has an assigned squad, delegate to that squad using the delegate_to_squad tool
- If the user asks about squad status, use the appropriate squad tools
- For general questions unrelated to any squad's project, answer directly
- NEVER answer project-specific questions yourself if a squad exists for that project

## Tool Selection: delegate_to_squad vs run_squad_instance
- **delegate_to_squad**: Use for planning, research, analysis, questions, reviews, or any task that does NOT require writing code. This is a lightweight message to the team lead.
- **run_squad_instance**: ONLY use when the user explicitly wants code written, committed, and a PR created. This spins up a full worktree, holds a meeting, assigns tasks, and creates a pull request. Never use this for planning or research.

## Delegation Behavior
- When you delegate to a squad, immediately tell the user you've delegated. Example: "I've handed this off to [squad name]. They'll deliver their results to your inbox when done."
- Do NOT wait for or relay the squad's full response — the squad will deliver via your inbox
- If the user explicitly asks for something to be delivered to their inbox (e.g., "put that in my inbox", "send me a summary in inbox"), delegate and confirm immediately
- Keep your delegation confirmations brief and conversational

## Inbox Rules
- When a squad has a pending question, proactively tell the user about it
- Use list_inbox to check for unread items when the user asks about notifications or inbox
- When the user answers a squad's question, use respond_to_inbox to deliver their response and unblock the squad
- Summarize deliverables in a friendly, readable way when presenting them to the user
`;

/**
 * Build the system message with current squad registry context.
 */
async function buildSystemMessage(): Promise<string> {
	try {
		const config = loadConfig();
		const squads = await listSquads();
		const wikiListing = getPageListing(getOrchestratorScopes());
		const skillsContent = await getActiveSkillsContent('orchestrator');

		const timezoneSection = `\n## User Timezone\nThe user's configured timezone is **${config.timezone}**. When the user mentions times (e.g., "at 3pm", "every morning at 9"), interpret them in this timezone. When creating schedules with cron expressions, convert from the user's timezone to UTC.\n`;

		const wikiSection = `\n## Wiki Knowledge\n${wikiListing}\n\nUse read_wiki to access page content. Use write_wiki to record important knowledge.\n`;

		if (squads.length === 0) {
			return `${SYSTEM_MESSAGE_BASE}${timezoneSection}\n## Active Squads\n(No squads currently active)${wikiSection}${skillsContent}`;
		}

		const squadList = squads
			.map(
				(s) =>
					`- **${s.name}**: project at \`${s.projectPath}\`${s.repoUrl ? ` (${s.repoUrl})` : ''} [autonomy: ${s.autonomyTier}]`,
			)
			.join('\n');

		return `${SYSTEM_MESSAGE_BASE}${timezoneSection}\n## Active Squads\n${squadList}\n\nWhen a user's message mentions any of the above projects (by name, path, or related topic), delegate to the corresponding squad.${wikiSection}${skillsContent}`;
	} catch {
		return `${SYSTEM_MESSAGE_BASE}\n## Active Squads\n(Unable to load squad registry)\n`;
	}
}

export async function initOrchestrator(config: IOConfig): Promise<void> {
	logger = createChildLogger('orchestrator');
	const client = await getClient();
	currentModel = config.defaultModel;
	currentByokHash = hashByok(config.byok);

	const provider = buildProvider(config.byok);
	if (provider) {
		logger.info({ type: provider.type, baseUrl: provider.baseUrl }, 'BYOK provider configured');
	} else {
		logger.info('Using GitHub Copilot authentication (no BYOK provider)');
	}

	const systemMessage = await buildSystemMessage();

	const sessionOptions = {
		model: config.defaultModel,
		streaming: true,
		tools: createOrchestratorTools(),
		systemMessage: { mode: 'replace' as const, content: systemMessage },
		onPermissionRequest: approveAll,
		infiniteSessions: {
			enabled: true,
			backgroundCompactionThreshold: 0.8,
			bufferExhaustionThreshold: 0.95,
		},
		...(provider && { provider }),
	};

	// Try to resume existing session
	const savedSessionId = await getSavedSessionId();
	if (savedSessionId) {
		try {
			session = await client.resumeSession(savedSessionId, sessionOptions);
			sessionId = savedSessionId;
			subscribeToUsage(session);
			logger.info({ sessionId }, 'Resumed orchestrator session');
			return;
		} catch {
			logger.info({ sessionId: savedSessionId }, 'Previous session expired, creating new one');
		}
	}

	// Create new session
	session = await client.createSession(sessionOptions);
	sessionId = session.sessionId;
	subscribeToUsage(session);
	await saveSessionId(sessionId);
	logger.info({ sessionId }, 'Created new orchestrator session');
}

function subscribeToUsage(sess: Session): void {
	sess.on('assistant.usage', (event) => {
		const data = event.data;
		if (data.inputTokens || data.outputTokens) {
			recordTokenUsage({
				agentRole: 'orchestrator',
				model: data.model,
				inputTokens: data.inputTokens ?? 0,
				outputTokens: data.outputTokens ?? 0,
			}).catch((err) => logger.error({ err }, 'Failed to record token usage'));
		}
	});
}

export function sendMessage(
	prompt: string,
	source: 'tui' | 'telegram' | 'web',
	onDelta: (accumulated: string, done: boolean) => void,
): Promise<string> {
	return new Promise((resolve, reject) => {
		messageQueue.push({ prompt, source, onDelta, resolve, reject });
		processQueue();
	});
}

async function processQueue(): Promise<void> {
	if (processing || messageQueue.length === 0) return;
	processing = true;

	try {
		while (messageQueue.length > 0) {
			const msg = messageQueue.shift()!;
			try {
				const response = await processMessage(msg);
				msg.resolve(response);
			} catch (err) {
				logger.error({ err }, 'Error processing message');
				msg.reject(err);
			}
		}
	} finally {
		processing = false;
	}
}

async function processMessage(msg: QueuedMessage): Promise<string> {
	if (!session) {
		throw new Error('Orchestrator session not initialized');
	}

	// Check if model or BYOK config changed — if so, recreate the session
	const freshConfig = loadConfig();
	const freshByokHash = hashByok(freshConfig.byok);
	const modelChanged = freshConfig.defaultModel !== currentModel;
	const byokChanged = freshByokHash !== currentByokHash;

	if (modelChanged || byokChanged) {
		if (modelChanged) {
			logger.info({ from: currentModel, to: freshConfig.defaultModel }, 'Model changed, recreating orchestrator session');
		}
		if (byokChanged) {
			const provider = buildProvider(freshConfig.byok);
			logger.info(
				{ byok: provider ? { type: provider.type, baseUrl: provider.baseUrl } : null },
				'BYOK config changed, recreating orchestrator session',
			);
		}
		currentModel = freshConfig.defaultModel;
		currentByokHash = freshByokHash;
		const provider = buildProvider(freshConfig.byok);
		const client = await getClient();
		const systemMessage = await buildSystemMessage();
		session = await client.createSession({
			model: currentModel,
			streaming: true,
			tools: createOrchestratorTools(),
			systemMessage: { mode: 'replace' as const, content: systemMessage },
			onPermissionRequest: approveAll,
			infiniteSessions: {
				enabled: true,
				backgroundCompactionThreshold: 0.8,
				bufferExhaustionThreshold: 0.95,
			},
			...(provider && { provider }),
		});
		sessionId = session.sessionId;
		subscribeToUsage(session);
		await saveSessionId(sessionId);
		logger.info({ sessionId, model: currentModel }, 'Orchestrator session recreated');
	}

	await appendConversationMessage({
		role: 'user',
		content: msg.prompt,
		source: msg.source,
	});

	let accumulated = '';
	msg.onDelta('', false);

	// Subscribe to streaming deltas
	const unsubDelta = session.on('assistant.message_delta', (event) => {
		accumulated += event.data.deltaContent;
		msg.onDelta(accumulated, false);
	});

	try {
		const result = await session.sendAndWait(
			{ prompt: msg.prompt },
			600_000, // 10 minute timeout
		);

		const finalContent =
			typeof result?.data?.content === 'string' && result.data.content.length > 0
				? result.data.content
				: accumulated || '(No response)';

		await appendConversationMessage({
			role: 'assistant',
			content: finalContent,
			source: msg.source,
		});
		msg.onDelta(finalContent, true);

		return finalContent;
	} finally {
		unsubDelta();
	}
}

export async function destroyOrchestrator(): Promise<void> {
	session = undefined;
	sessionId = undefined;
}

async function getSavedSessionId(): Promise<string | undefined> {
	try {
		const db = getDatabase();
		const result = await db.execute(
			"SELECT value FROM io_state WHERE key = 'orchestrator_session_id'",
		);
		if (result.rows.length > 0) {
			return result.rows[0].value as string;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

async function saveSessionId(id: string): Promise<void> {
	const db = getDatabase();
	await db.execute({
		sql: "INSERT OR REPLACE INTO io_state (key, value) VALUES ('orchestrator_session_id', ?)",
		args: [id],
	});
}

/** Stable hash of BYOK config for change detection (does not include the API key in logs). */
function hashByok(byok: IOConfig['byok']): string {
	if (!byok) return '';
	return `${byok.type}|${byok.baseUrl}|${byok.apiKey}`;
}

