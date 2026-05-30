import { createTelegramBot } from './bot.js';
import { createDaemonClient } from './client.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
	console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
	process.exit(1);
}

const port = Number.parseInt(process.env.IO_API_PORT ?? '7777', 10);
const allowedChats = process.env.TELEGRAM_ALLOWED_CHAT_IDS
	? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map((id) => Number.parseInt(id.trim(), 10))
	: undefined;

const client = createDaemonClient(port);
const bot = createTelegramBot({ token, allowedChatIds: allowedChats }, client);

async function start() {
	console.log('IO Telegram Bot starting...');

	// Connect to daemon
	try {
		const connectionId = await client.connect();
		console.log(`Connected to daemon (${connectionId})`);
	} catch {
		console.warn('Could not connect to daemon on startup — will retry automatically');
	}

	// Start bot polling
	bot.start({
		onStart: () => {
			console.log('Telegram bot is running');
		},
	});
}

// Graceful shutdown
function shutdown() {
	console.log('Shutting down...');
	bot.stop();
	client.disconnect();
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
