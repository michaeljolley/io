import { useScreenSize } from 'fullscreen-ink';
import { Box, Text, useApp, useInput } from 'ink';
import { ChatPanel } from './components/ChatPanel.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { useDaemon } from './hooks/use-daemon.js';

interface AppProps {
	port: number;
}

export function App({ port }: AppProps) {
	const app = useApp();
	const { height } = useScreenSize();
	const { messages, send, connected, error, unreadInbox } = useDaemon(port);

	useInput((input, key) => {
		if (input === 'q' && key.ctrl) {
			app.exit();
		}
	});

	// Reserve space: 1 header + 3 input box (border+content+border) + 1 footer
	const chatHeight = Math.max(height - 7, 5);

	return (
		<Box flexDirection="column" height={height}>
			{/* Header */}
			<Box justifyContent="center" paddingY={0}>
				<Text bold color="blue">
					IO — AI Orchestrator
				</Text>
			</Box>

			{/* Main area: chat + sidebar */}
			<Box flexGrow={1} flexDirection="row">
				<Box flexDirection="column" flexGrow={1}>
					<ChatPanel messages={messages} height={chatHeight} />
					<InputBox onSubmit={send} disabled={!connected} />
				</Box>
				<StatusBar connected={connected} error={error} unreadInbox={unreadInbox} />
			</Box>

			{/* Footer */}
			<Box justifyContent="space-between" paddingX={1}>
				<Text dimColor>Ctrl+Q to quit</Text>
				<Text dimColor>port:{port}</Text>
			</Box>
		</Box>
	);
}
