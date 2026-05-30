import { Box, Text } from 'ink';

interface StatusBarProps {
	connected: boolean;
	error: string | null;
}

export function StatusBar({ connected, error }: StatusBarProps) {
	return (
		<Box
			flexDirection="column"
			width={24}
			borderStyle="single"
			borderColor={connected ? 'green' : 'red'}
			paddingX={1}
		>
			<Text bold color="white">
				IO Status
			</Text>
			<Box marginTop={1}>
				<Text color={connected ? 'green' : 'red'}>
					{connected ? '● Connected' : '○ Disconnected'}
				</Text>
			</Box>
			{error && (
				<Box marginTop={1}>
					<Text color="red" wrap="truncate-end">
						{error}
					</Text>
				</Box>
			)}
			<Box marginTop={1} flexDirection="column">
				<Text bold dimColor>
					Squads
				</Text>
				<Text dimColor>No active squads</Text>
			</Box>
		</Box>
	);
}
