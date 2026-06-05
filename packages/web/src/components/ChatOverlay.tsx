import { IoMark } from "@/components/ui/io-mark";
import { configuredMarked as marked } from "@/components/ui/markdown";
import { useChat } from "@/hooks/use-chat";
import { MessageCircle, Paperclip, Send, Square, X } from "lucide-react";
import {
	type ChangeEvent,
	type KeyboardEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export function ChatOverlay() {
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const messagesRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const {
		messages,
		streaming,
		isStreaming,
		connected,
		sendChatMessage,
		addUserMessage,
		uploadAttachment,
	} = useChat();

	const recentMessages = useMemo(() => messages.slice(-10), [messages]);

	useLayoutEffect(() => {
		const container = messagesRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	});

	async function handleSend() {
		const text = input.trim();
		if ((!text && !selectedFile) || isStreaming) return;

		const messageId = crypto.randomUUID();
		const attachmentName = selectedFile?.name;
		const outboundContent = [text, attachmentName ? `Attachment: ${attachmentName}` : ""]
			.filter(Boolean)
			.join("\n\n");

		addUserMessage({
			id: messageId,
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
			attachmentName,
		});
		setInput("");
		setSelectedFile(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		try {
			if (selectedFile) {
				await uploadAttachment(selectedFile, messageId);
			}
			await sendChatMessage(outboundContent);
			setOpen(true);
		} catch {
			// handled by context
		}
	}

	function handleInput(event: ChangeEvent<HTMLTextAreaElement>) {
		setInput(event.target.value);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSend();
		}
	}

	return (
		<div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
			{open && (
				<div
					className="w-[340px] h-[460px] rounded-2xl border border-white/[0.09] shadow-2xl overflow-hidden flex flex-col"
					style={{ background: "#1c1c1c" }}
				>
					<div
						className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0"
						style={{
							background:
								"linear-gradient(135deg, rgba(216,51,51,0.18) 0%, rgba(240,65,255,0.10) 100%)",
						}}
					>
						<div className="flex items-center gap-2.5">
							<IoMark height={20} />
							<span
								className="text-xl text-white tracking-wider leading-none"
								style={{ fontFamily: "'Bebas Neue', sans-serif" }}
							>
								IO
							</span>
							<span className="text-[10px] font-mono text-zinc-600 mt-0.5">quick chat</span>
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="p-1 rounded-lg hover:bg-white/[0.07] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>

					<div ref={messagesRef} className="flex-1 overflow-y-auto p-3 space-y-2">
						{recentMessages.length === 0 && !isStreaming ? (
							<div className="h-full flex items-center justify-center text-center px-6">
								<p className="text-xs text-zinc-500">Ask IO anything without leaving this page.</p>
							</div>
						) : (
							recentMessages.map((message) => (
								<div
									key={message.id}
									className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
									title={message.timestamp}
								>
									<div className={`max-w-[85%] ${message.role === "user" ? "ml-8" : "mr-8"}`}>
										{message.attachmentName && (
											<div className="mb-1 rounded-xl border border-white/[0.08] bg-[#1e1e1e] px-3 py-2 text-[11px] font-mono text-zinc-400">
												{message.attachmentName}
											</div>
										)}
										{message.content && (
											<div
												className={
													message.role === "user"
														? "bg-gradient-to-br from-[#E43A9C] to-[#D83333] rounded-xl px-3 py-2 text-xs text-white whitespace-pre-wrap"
														: "bg-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-zinc-200"
												}
											>
												{message.role === "user" ? (
													message.content
												) : (
													<div
														className="prose-io [&_*]:text-xs"
														// biome-ignore lint: markdown rendering
														dangerouslySetInnerHTML={{
															__html: marked.parse(message.content) as string,
														}}
													/>
												)}
											</div>
										)}
									</div>
								</div>
							))
						)}

						{isStreaming && (
							<div className="flex justify-start">
								<div className="max-w-[85%] mr-8 bg-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-zinc-200">
									{streaming ? (
										<div
											className="prose-io [&_*]:text-xs"
											// biome-ignore lint: streaming markdown
											dangerouslySetInnerHTML={{ __html: marked.parse(streaming) as string }}
										/>
									) : (
										<div className="flex items-center gap-1.5 py-1">
											{[0, 120, 240].map((delay) => (
												<span
													key={delay}
													className="w-1.5 h-1.5 rounded-full bg-[#E43A9C] animate-bounce"
													style={{ animationDelay: `${delay}ms` }}
												/>
											))}
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="p-2.5 border-t border-white/[0.06]">
						<div className="bg-[#252525] border border-white/[0.08] rounded-xl overflow-hidden transition-colors focus-within:border-[#E43A9C]/30">
							<input
								ref={fileInputRef}
								type="file"
								className="hidden"
								onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
							/>
							{selectedFile && (
								<div className="px-3 pt-2 text-[10px] font-mono text-zinc-400">
									Attached: {selectedFile.name}
								</div>
							)}
							<div className="flex items-center gap-1.5 px-2.5 py-2">
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors flex-shrink-0 cursor-pointer"
								>
									<Paperclip className="w-3.5 h-3.5" />
								</button>
								<textarea
									ref={textareaRef}
									value={input}
									onChange={handleInput}
									onKeyDown={handleKeyDown}
									placeholder="Message IO…"
									rows={1}
									className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-700 resize-none focus:outline-none leading-relaxed"
									style={{ minHeight: "18px", maxHeight: "96px", fontFamily: "Inter, sans-serif" }}
								/>
								<button
									type="button"
									onClick={() => void handleSend()}
									disabled={(!input.trim() && !selectedFile) || (!connected && !isStreaming)}
									className="p-1.5 rounded-lg text-white disabled:opacity-25 disabled:cursor-not-allowed transition-opacity hover:opacity-90 flex-shrink-0 cursor-pointer"
									style={{ background: "linear-gradient(135deg, #D83333, #E43A9C)" }}
								>
									{isStreaming ? <Square className="w-3 h-3" /> : <Send className="w-3 h-3" />}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="w-12 h-12 rounded-full primary-btn shadow-lg text-white flex items-center justify-center hover:opacity-95 transition-opacity"
				aria-label={open ? "Close quick chat" : "Open quick chat"}
			>
				<MessageCircle className="w-5 h-5" />
			</button>
		</div>
	);
}
