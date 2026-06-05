import { IoMark } from "@/components/ui/io-mark";
import { configuredMarked as marked } from "@/components/ui/markdown";
import { Chip } from "@/components/ui/shared";
import { useChat } from "@/hooks/use-chat";
import { useTimezone } from "@/hooks/use-config";
import { useAuth } from "@/lib/auth";
import { formatTime as fmtTime } from "@/lib/timezone";
import { Activity, ChevronDown, Paperclip, Send, Square } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

export function ChatView() {
	const { session } = useAuth();
	const timezone = useTimezone();
	const {
		messages,
		streaming,
		isStreaming,
		isThinking,
		sendChatMessage,
		stopStreaming,
		addUserMessage,
		uploadAttachment,
	} = useChat();
	const [input, setInput] = useState("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [expandedTool, setExpandedTool] = useState<string | null>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useLayoutEffect(() => {
		const container = messagesContainerRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	});

	async function handleSend() {
		const text = input.trim();
		if ((!text && !selectedFile) || isStreaming || isThinking) return;

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
		} catch {
			// handled by context
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
		setInput(e.target.value);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
		}
	}

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Messages */}
			<div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
					>
						{/* Avatar */}
						<div
							className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono mt-0.5 ${
								msg.role === "user"
									? "border border-[#E43A9C]/30 text-[#E43A9C]"
									: "bg-[#282828] border border-white/[0.07] text-zinc-500"
							}`}
							style={msg.role === "user" ? { background: "rgba(228,58,156,0.12)" } : undefined}
						>
							{msg.role === "user" ? (
								(session?.user?.email?.charAt(0).toUpperCase() ?? "U")
							) : (
								<IoMark height={12} />
							)}
						</div>

						{/* Content */}
						<div
							className={`flex flex-col gap-1.5 max-w-[72%] ${msg.role === "user" ? "items-end" : "items-start"}`}
						>
							{/* Tool call card */}
							{msg.toolCall && (
								<button
									type="button"
									onClick={() => setExpandedTool(expandedTool === msg.id ? null : msg.id)}
									className="w-full text-left border border-white/[0.07] bg-[#1e1e1e] rounded-xl px-3 py-2 flex items-center gap-2 hover:border-[#E43A9C]/25 transition-colors"
								>
									<Activity className="w-3 h-3 text-[#E43A9C] flex-shrink-0" />
									<span className="text-[11px] font-mono text-zinc-400 flex-1">
										{msg.toolCall.name}
									</span>
									<Chip
										variant={
											msg.toolCall.status === "done"
												? "success"
												: msg.toolCall.status === "error"
													? "error"
													: "warning"
										}
									>
										{msg.toolCall.status}
									</Chip>
									<ChevronDown
										className={`w-3 h-3 text-zinc-600 transition-transform flex-shrink-0 ${expandedTool === msg.id ? "rotate-180" : ""}`}
									/>
								</button>
							)}
							{msg.toolCall && expandedTool === msg.id && (
								<div className="w-full bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2">
									<p className="text-[11px] font-mono text-zinc-500">{msg.toolCall.result}</p>
								</div>
							)}

							{msg.attachmentName && (
								<div className="rounded-xl border border-white/[0.08] bg-[#1e1e1e] px-3 py-2 text-[11px] font-mono text-zinc-400">
									{msg.attachmentName}
								</div>
							)}

							{/* Message bubble */}
							{msg.content && (
								<div
									className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
										msg.role === "user"
											? "text-white rounded-tr-sm"
											: "bg-[#222222] border border-white/[0.07] text-zinc-200 rounded-tl-sm"
									}`}
									style={
										msg.role === "user"
											? { background: "linear-gradient(135deg, #D83333 0%, #C0285E 100%)" }
											: undefined
									}
								>
									{msg.role === "user" ? (
										<p className="whitespace-pre-wrap">{msg.content}</p>
									) : (
										<div
											className="prose-io"
											// biome-ignore lint: markdown rendering
											dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
										/>
									)}
								</div>
							)}

							{/* Timestamp */}
							<span className="text-[11px] text-zinc-700 font-mono px-0.5">
								{fmtTime(msg.timestamp, timezone)}
							</span>
						</div>
					</div>
				))}

				{/* Thinking indicator */}
				{isThinking && (
					<div className="flex gap-3">
						<div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-[#282828] border border-white/[0.07] mt-0.5">
							<IoMark height={12} />
						</div>
						<div className="bg-[#222222] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
							{[0, 120, 240].map((d) => (
								<span
									key={d}
									className="w-1.5 h-1.5 rounded-full bg-[#E43A9C] animate-bounce"
									style={{ animationDelay: `${d}ms` }}
								/>
							))}
						</div>
					</div>
				)}

				{/* Streaming indicator */}
				{isStreaming && streaming && (
					<div className="flex gap-3">
						<div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-[#282828] border border-white/[0.07] mt-0.5">
							<IoMark height={12} />
						</div>
						<div className="bg-[#222222] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[72%]">
							<div
								className="prose-io text-sm"
								// biome-ignore lint: streaming markdown
								dangerouslySetInnerHTML={{ __html: marked.parse(streaming) as string }}
							/>
						</div>
					</div>
				)}

				{/* Streaming dots (no content yet) */}
				{isStreaming && !streaming && (
					<div className="flex gap-3">
						<div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-[#282828] border border-white/[0.07] mt-0.5">
							<IoMark height={12} />
						</div>
						<div className="bg-[#222222] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
							{[0, 120, 240].map((d) => (
								<span
									key={d}
									className="w-1.5 h-1.5 rounded-full bg-[#E43A9C] animate-bounce"
									style={{ animationDelay: `${d}ms` }}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Input area */}
			<div className="border-t border-white/[0.06] p-4 flex-shrink-0">
				<div className="bg-[#1e1e1e] border border-white/[0.08] rounded-2xl overflow-hidden transition-colors focus-within:border-[#E43A9C]/30">
					<input
						ref={fileInputRef}
						type="file"
						className="hidden"
						onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
					/>
					{selectedFile && (
						<div className="px-4 pt-3 text-[11px] font-mono text-zinc-400">
							Attached: {selectedFile.name}
						</div>
					)}
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder="Message IO…"
						rows={1}
						className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-zinc-200 placeholder:text-zinc-700 resize-none focus:outline-none"
						style={{ minHeight: "42px", maxHeight: "160px", fontFamily: "Inter, sans-serif" }}
					/>
					<div className="flex items-center justify-between px-3 pb-2.5">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-700 hover:text-zinc-400 transition-colors"
						>
							<Paperclip className="w-4 h-4" />
						</button>
						<div className="flex items-center gap-2">
							{isStreaming ? (
								<button
									type="button"
									onClick={() => stopStreaming()}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors"
								>
									<Square className="w-3 h-3" /> Stop
								</button>
							) : (
								<button
									type="button"
									onClick={handleSend}
									disabled={(!input.trim() && !selectedFile) || isThinking}
									className="p-2 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
									style={{ background: "linear-gradient(135deg, #D83333, #E43A9C)" }}
								>
									<Send className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					</div>
				</div>
				<p className="text-center text-[11px] text-zinc-800 font-mono mt-2">
					IO may make mistakes. Verify important outputs.
				</p>
			</div>
		</div>
	);
}
