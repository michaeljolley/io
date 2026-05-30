import { approveAll } from '@github/copilot-sdk';
import type { IOConfig } from '../config.js';
import { createChildLogger } from '../logging/logger.js';
import { getActiveSkillsContent } from '../skills/index.js';
import { listSquads } from '../squad/manager.js';
import { getDatabase } from '../store/db.js';
import { getOrchestratorScopes, getPageListing } from '../wiki/index.js';
import { getClient } from './client.js';
import { createOrchestratorTools } from './tools.js';

type Session = Awaited<ReturnType<Awaited<ReturnType<typeof getClient>>['createSession']>>;

let logger: ReturnType<typeof createChildLogger>;

let session: Session | undefined;
let sessionId: string | undefined;

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
- If the user's message relates to a project that has an assigned squad, ALWAYS delegate to that squad using the delegate_to_squad tool
- If the user asks about squad status, use the appropriate squad tools
- For general questions unrelated to any squad's project, answer directly
- NEVER answer project-specific questions yourself if a squad exists for that project

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
		const squads = await listSquads();
		const wikiListing = getPageListing(getOrchestratorScopes());
		const skillsContent = await getActiveSkillsContent('orchestrator');

		const wikiSection = `\n## Wiki Knowledge\n${wikiListing}\n\nUse read_wiki to access page content. Use write_wiki to record important knowledge.\n`;

		if (squads.length === 0) {
			return `${SYSTEM_MESSAGE_BASE}\n## Active Squads\n(No squads currently active)${wikiSection}${skillsContent}`;
		}

		const squadList = squads
			.map(
				(s) =>
					`- **${s.name}**: project at \`${s.projectPath}\`${s.repoUrl ? ` (${s.repoUrl})` : ''} [autonomy: ${s.autonomyTier}]`,
			)
			.join('\n');

		return `${SYSTEM_MESSAGE_BASE}\n## Active Squads\n${squadList}\n\nWhen a user's message mentions any of the above projects (by name, path, or related topic), delegate to the corresponding squad.${wikiSection}${skillsContent}`;
	} catch {
		return `${SYSTEM_MESSAGE_BASE}\n## Active Squads\n(Unable to load squad registry)\n`;
	}
}

export async function initOrchestrator(config: IOConfig): Promise<void> {
	logger = createChildLogger('orchestrator');
	const client = await getClient();

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
	};

	// Try to resume existing session
	const savedSessionId = await getSavedSessionId();
	if (savedSessionId) {
		try {
			session = await client.resumeSession(savedSessionId, sessionOptions);
			sessionId = savedSessionId;
			logger.info({ sessionId }, 'Resumed orchestrator session');
			return;
		} catch (err) {
			logger.warn({ err, sessionId: savedSessionId }, 'Failed to resume session, creating new one');
		}
	}

	// Create new session
	session = await client.createSession(sessionOptions);
	sessionId = session.sessionId;
	await saveSessionId(sessionId);
	logger.info({ sessionId }, 'Created new orchestrator session');
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

	processing = false;
}

async function processMessage(msg: QueuedMessage): Promise<string> {
	if (!session) {
		throw new Error('Orchestrator session not initialized');
	}

	let accumulated = '';

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

		const finalContent = result?.data?.content || accumulated || '(No response)';
		msg.onDelta(finalContent, true);

		// Persist conversation (fire-and-forget)
		persistConversation(msg.prompt, finalContent, msg.source);

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

function persistConversation(
	userMessage: string,
	assistantResponse: string,
	source?: string,
): void {
	const db = getDatabase();
	const now = new Date().toISOString();

	db.execute({
		sql: "INSERT INTO conversations (id, role, content, source, created_at) VALUES (?, 'user', ?, ?, ?)",
		args: [crypto.randomUUID(), userMessage, source ?? null, now],
	});
	db.execute({
		sql: "INSERT INTO conversations (id, role, content, source, created_at) VALUES (?, 'assistant', ?, ?, ?)",
		args: [crypto.randomUUID(), assistantResponse, source ?? null, now],
	});
}
