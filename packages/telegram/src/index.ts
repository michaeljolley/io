import { loadConfig } from '@io/shared';
import { createTelegramBot } from './bot.js';
import { createDaemonClient } from './client.js';

const config = loadConfig();

const token = config.telegram.botToken;
if (!token) {
	console.error(
		'Error: Telegram bot token is required. Set TELEGRAM_BOT_TOKEN env var or telegram.botToken in ~/.io/config.json',
	);
	process.exit(1);
}

const port = config.apiPort;
const allowedChats =
	config.telegram.allowedChatIds.length > 0 ? config.telegram.allowedChatIds : undefined;

const client = createDaemonClient(port);
const bot = createTelegramBot({ token, allowedChatIds: allowedChats, apiPort: port }, client);

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
