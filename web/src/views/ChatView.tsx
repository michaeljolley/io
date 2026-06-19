import { Paperclip, Send, Square, X } from "lucide-react";
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { IoMark } from "@/components/IoMark";
import { MessageBubble } from "@/components/ui/MessageBubble";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import {
  fileToMessageAttachment,
  formatAttachmentSize,
  type MessageAttachment,
  validateAttachmentSizes,
} from "@/lib/attachments";
import { attachFocusOnOpen } from "@/lib/focusOnAnimation";
import { useChatStore } from "@/stores/chat";

export default function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [composerError, setComposerError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cleanup = attachFocusOnOpen(viewRef.current, textareaRef.current);
    return cleanup;
  }, []);

  useAutoScroll(messagesContainerRef, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    setInput("");
    setComposerError("");
    const attachments = [...pendingAttachments];
    setPendingAttachments([]);
    await sendMessage(trimmed, attachments);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const newAttachments: MessageAttachment[] = [];
    for (const file of Array.from(files)) {
      newAttachments.push(await fileToMessageAttachment(file));
    }
    const combined = [...pendingAttachments, ...newAttachments];
    const validated = validateAttachmentSizes(combined);
    if (!validated.ok) {
      setComposerError(validated.error);
      return;
    }
    setPendingAttachments(combined);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      ref={viewRef}
      className="flex flex-col h-full min-h-0"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <IoMark height={48} />
            <p className="text-zinc-600 font-mono text-sm">Start a conversation with IO</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <MessageBubble msg={msg} />
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-white/[0.06] p-4 flex-shrink-0">
        {composerError && <div className="text-[14px] font-mono text-red-400 mb-2">{composerError}</div>}

        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((att, i) => (
              <div
                key={`${att.name}:${att.size}:${att.mimeType}`}
                className="flex items-center gap-2 bg-[#252525] border border-white/[0.08] rounded-xl px-3 py-1.5"
              >
                <span className="text-[13px] font-mono text-zinc-400 truncate max-w-[120px]">{att.name}</span>
                <span className="text-[11px] font-mono text-zinc-600">{formatAttachmentSize(att.size)}</span>
                <button
                  onClick={() => setPendingAttachments((p) => p.filter((_, idx) => idx !== i))}
                  className="text-zinc-600 hover:text-zinc-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`bg-[#1e1e1e] border rounded-2xl overflow-hidden transition-colors focus-within:border-[#66FCF1]/30 ${isDragging ? "border-[#66FCF1]/50" : "border-white/[0.08]"}`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message IO…"
            rows={1}
            className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-zinc-200 placeholder:text-zinc-700 resize-none focus:outline-none"
            style={{ minHeight: "42px", maxHeight: "160px", fontFamily: "Inter, sans-serif" }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.onchange = () => {
                  if (input.files) handleFiles(input.files);
                };
                input.click();
              }}
              className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[14px] font-mono text-zinc-300 transition-colors"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  className="p-2 rounded-xl text-[#1F2833] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                  style={{ background: "var(--base-teal)" }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-[14px] text-zinc-800 font-mono mt-2">
          IO may make mistakes. Verify important outputs.
        </p>
      </div>
    </div>
  );
}
