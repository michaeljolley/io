#!/usr/bin/env node
import { loadConfig } from '@io/shared';
import { withFullScreen } from 'fullscreen-ink';
import { createElement } from 'react';
import { App } from './App.js';

async function isDaemonRunning(port: number): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/api/health`);
		return res.ok;
	} catch {
		return false;
	}
}

async function main() {
	const config = loadConfig();
	const port = config.apiPort;

	const running = await isDaemonRunning(port);
	if (!running) {
		console.error(
			`IO daemon is not running on port ${port}.\nStart it with: io-daemon\nOr set IO_PORT if using a different port.`,
		);
		process.exit(1);
	}

	const ink = withFullScreen(createElement(App, { port }));
	await ink.start();
	await ink.waitUntilExit();
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
