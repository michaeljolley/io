export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	source?: 'tui' | 'telegram' | 'web';
	attachments?: string[];
	createdAt: Date;
}

export interface Conversation {
	id: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}
