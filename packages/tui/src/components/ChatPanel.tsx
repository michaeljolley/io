import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/use-daemon.js';

interface ChatPanelProps {
	messages: ChatMessage[];
	height: number;
}

function MessageRow({ msg }: { msg: ChatMessage }) {
	const prefix = msg.role === 'user' ? '▶ You' : '◀ IO';
	const color = msg.role === 'user' ? 'cyan' : 'green';

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text color={color} bold>
				{prefix}
				{msg.streaming ? ' ...' : ''}
			</Text>
			<Box marginLeft={2}>
				<Text wrap="wrap">{msg.content}</Text>
			</Box>
		</Box>
	);
}

export function ChatPanel({ messages, height }: ChatPanelProps) {
	// Show only the last N messages that fit
	const visibleMessages = messages.slice(-Math.max(height - 2, 5));

	return (
		<Box flexDirection="column" flexGrow={1} height={height} overflow="hidden">
			{visibleMessages.length === 0 ? (
				<Box flexGrow={1} alignItems="center" justifyContent="center">
					<Text dimColor>Send a message to get started...</Text>
				</Box>
			) : (
				visibleMessages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
			)}
		</Box>
	);
}
