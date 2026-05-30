import { Bot, type Context } from 'grammy';
import type { DaemonClient, DaemonMessage } from './client.js';
import { type StreamingEditor, createStreamingEditor } from './streaming.js';

interface BotConfig {
	token: string;
	allowedChatIds?: number[];
	apiPort: number;
}

/**
 * Active streaming sessions — maps a response correlation to the editor.
 * Since the daemon WS broadcasts all messages, we track which chat expects which response.
 */
interface PendingResponse {
	chatId: number;
	editor: StreamingEditor;
}

export function createTelegramBot(config: BotConfig, client: DaemonClient) {
	const bot = new Bot(config.token);
	let pendingResponse: PendingResponse | null = null;

	// Access control
	function isAllowed(ctx: Context): boolean {
		if (!config.allowedChatIds || config.allowedChatIds.length === 0) return true;
		return ctx.chat ? config.allowedChatIds.includes(ctx.chat.id) : false;
	}

	// Listen for daemon WebSocket messages
	client.onMessage((msg: DaemonMessage) => {
		if (!pendingResponse) return;

		if (msg.type === 'delta' && msg.content) {
			pendingResponse.editor.update(msg.content);
		} else if (msg.type === 'message' && msg.content) {
			pendingResponse.editor.finish(msg.content);
			pendingResponse = null;
		} else if (msg.type === 'error') {
			pendingResponse.editor.finish(`⚠️ ${msg.content ?? 'An error occurred'}`);
			pendingResponse = null;
		}
	});

	// /start command
	bot.command('start', async (ctx) => {
		if (!isAllowed(ctx)) return;
		await ctx.reply(
			"🤖 *IO Orchestrator*\n\nI'm your AI assistant. Send me a message and I'll respond.\n\nCommands:\n/status — Check daemon health\n/squads — List active squads\n/inbox — View unread inbox items",
			{ parse_mode: 'Markdown' },
		);
	});

	// /status command
	bot.command('status', async (ctx) => {
		if (!isAllowed(ctx)) return;
		const connected = client.isConnected();
		if (!connected) {
			await ctx.reply('❌ Not connected to IO daemon');
			return;
		}

		try {
			const port = config.apiPort;
			const res = await fetch(`http://127.0.0.1:${port}/api/health`);
			if (res.ok) {
				const data = (await res.json()) as { status: string; uptime?: number };
				const uptime = data.uptime ? `${Math.floor(data.uptime / 60)}m` : 'unknown';
				await ctx.reply(`✅ Daemon is healthy\n⏱ Uptime: ${uptime}`);
			} else {
				await ctx.reply('⚠️ Daemon responded with error');
			}
		} catch {
			await ctx.reply('❌ Cannot reach IO daemon API');
		}
	});

	// /squads command
	bot.command('squads', async (ctx) => {
		if (!isAllowed(ctx)) return;

		try {
			const port = config.apiPort;
			const res = await fetch(`http://127.0.0.1:${port}/api/squads`);
			if (!res.ok) {
				await ctx.reply('⚠️ Failed to fetch squads');
				return;
			}

			const data = (await res.json()) as {
				squads: Array<{
					name: string;
					projectPath: string;
					memberCount: number;
					instanceCount: number;
				}>;
			};

			if (data.squads.length === 0) {
				await ctx.reply('No active squads. Ask me to hire one!');
				return;
			}

			const lines = data.squads.map(
				(s) =>
					`• *${s.name}* — ${s.projectPath}\n  ${s.memberCount} members, ${s.instanceCount} instances`,
			);
			await ctx.reply(`📋 *Active Squads*\n\n${lines.join('\n\n')}`, {
				parse_mode: 'Markdown',
			});
		} catch {
			await ctx.reply('❌ Cannot reach IO daemon API');
		}
	});

	// /inbox command
	bot.command('inbox', async (ctx) => {
		if (!isAllowed(ctx)) return;

		try {
			const port = config.apiPort;
			const res = await fetch(`http://127.0.0.1:${port}/api/inbox?status=unread`);
			if (!res.ok) {
				await ctx.reply('⚠️ Failed to fetch inbox');
				return;
			}

			const data = (await res.json()) as {
				entries: Array<{
					id: string;
					kind: string;
					title: string;
					content: string;
					createdAt: string;
				}>;
			};

			if (data.entries.length === 0) {
				await ctx.reply('📭 Inbox is empty — no unread items');
				return;
			}

			const lines = data.entries.map((e) => {
				const icon = e.kind === 'question' ? '❓' : '📋';
				return `${icon} *${e.title}*\n${e.content.slice(0, 200)}${e.content.length > 200 ? '...' : ''}`;
			});
			await ctx.reply(`📬 *Inbox* (${data.entries.length} unread)\n\n${lines.join('\n\n')}`, {
				parse_mode: 'Markdown',
			});
		} catch {
			await ctx.reply('❌ Cannot reach IO daemon API');
		}
	});

	// Text messages → forward to orchestrator
	bot.on('message:text', async (ctx) => {
		if (!isAllowed(ctx)) return;
		if (!client.isConnected()) {
			await ctx.reply('❌ Not connected to IO daemon. Attempting reconnect...');
			return;
		}

		// Send a "thinking" placeholder
		const placeholder = await ctx.reply('💭 Thinking...');

		// Set up the streaming editor for this response
		pendingResponse = {
			chatId: ctx.chat.id,
			editor: createStreamingEditor(bot.api, ctx.chat.id, placeholder.message_id),
		};

		// Send the message to the daemon
		client.send(ctx.message.text);
	});

	// Photo messages — download and include description
	bot.on('message:photo', async (ctx) => {
		if (!isAllowed(ctx)) return;
		if (!client.isConnected()) {
			await ctx.reply('❌ Not connected to IO daemon');
			return;
		}

		const caption = ctx.message.caption ?? 'User sent a photo';
		const placeholder = await ctx.reply('💭 Processing image...');

		pendingResponse = {
			chatId: ctx.chat.id,
			editor: createStreamingEditor(bot.api, ctx.chat.id, placeholder.message_id),
		};

		// For now, just forward caption context (full image handling requires daemon attachment API)
		client.send(`[Image attached] ${caption}`);
	});

	// Document messages
	bot.on('message:document', async (ctx) => {
		if (!isAllowed(ctx)) return;
		if (!client.isConnected()) {
			await ctx.reply('❌ Not connected to IO daemon');
			return;
		}

		const fileName = ctx.message.document.file_name ?? 'unknown file';
		const caption = ctx.message.caption ?? '';
		const placeholder = await ctx.reply('💭 Processing file...');

		pendingResponse = {
			chatId: ctx.chat.id,
			editor: createStreamingEditor(bot.api, ctx.chat.id, placeholder.message_id),
		};

		client.send(`[File attached: ${fileName}] ${caption}`);
	});

	return bot;
}
