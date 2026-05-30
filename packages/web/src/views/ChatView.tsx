import { type WsMessage, useWebSocket } from '@/hooks/use-websocket';
import { api } from '@/lib/api';
import { Send } from 'lucide-react';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

export function ChatView() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [streaming, setStreaming] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Load conversation history
	useEffect(() => {
		api
			.get<{ messages: Message[] }>('/conversations?limit=50')
			.then((data) => setMessages(data.messages))
			.catch(() => {});
	}, []);

	const handleDelta = useCallback((accumulated: string) => {
		setIsStreaming(true);
		setStreaming(accumulated);
	}, []);

	const handleMessage = useCallback((content: string) => {
		setIsStreaming(false);
		setStreaming('');
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: 'assistant',
				content,
				timestamp: new Date().toISOString(),
			},
		]);
	}, []);

	const handleEvent = useCallback((_msg: WsMessage) => {
		// Could show notifications/toasts here
	}, []);

	const { connected, sendMessage } = useWebSocket({
		onDelta: handleDelta,
		onMessage: handleMessage,
		onEvent: handleEvent,
	});

	// Auto-scroll
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, streaming]);

	function handleSend() {
		const text = input.trim();
		if (!text || isStreaming) return;

		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() },
		]);
		setInput('');
		sendMessage(text);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<header className="h-14 flex items-center px-6 border-b border-[var(--color-border)] shrink-0">
				<h1 className="text-lg font-semibold gradient-text">Chat</h1>
				<div className="ml-auto flex items-center gap-2">
					<span
						className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-destructive)]'}`}
					/>
					<span className="text-xs text-[var(--color-muted-foreground)]">
						{connected ? 'Connected' : 'Disconnected'}
					</span>
				</div>
			</header>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
				{messages.map((msg) => (
					<MessageBubble key={msg.id} message={msg} />
				))}
				{isStreaming && (
					<MessageBubble
						message={{ id: 'streaming', role: 'assistant', content: streaming, timestamp: '' }}
					/>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="px-6 pb-4 pt-2 border-t border-[var(--color-border)]">
				<div className="glass-card flex items-end gap-2 p-3">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Message IO..."
						rows={1}
						className="flex-1 bg-transparent resize-none outline-none text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] max-h-32"
					/>
					<button
						onClick={handleSend}
						disabled={!input.trim() || isStreaming}
						className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 transition-opacity hover:opacity-90"
					>
						<Send size={16} />
					</button>
				</div>
			</div>
		</div>
	);
}

function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === 'user';

	if (isUser) {
		return (
			<div className="flex justify-end">
				<div className="max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/20">
					<p className="text-sm whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		);
	}

	const html = marked.parse(message.content) as string;

	return (
		<div className="flex justify-start">
			<div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 glass-card">
				<div
					className="prose-io text-sm"
					// biome-ignore lint: markdown rendering
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</div>
		</div>
	);
}
