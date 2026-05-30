import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useState } from 'react';

interface InputBoxProps {
	onSubmit: (content: string) => void;
	disabled?: boolean;
}

export function InputBox({ onSubmit, disabled }: InputBoxProps) {
	const [key, setKey] = useState(0);

	const handleSubmit = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return;
		onSubmit(trimmed);
		// Re-mount TextInput to clear it
		setKey((k) => k + 1);
	};

	return (
		<Box borderStyle="single" borderColor={disabled ? 'gray' : 'blue'} paddingX={1}>
			{disabled ? (
				<Text dimColor>Connecting...</Text>
			) : (
				<Box flexGrow={1}>
					<Text color="blue" bold>
						{'> '}
					</Text>
					<TextInput key={key} placeholder="Type a message..." onSubmit={handleSubmit} />
				</Box>
			)}
		</Box>
	);
}
