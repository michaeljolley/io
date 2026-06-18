import { FileText, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import {
  fileToMessageAttachment,
  formatAttachmentSize,
  type MessageAttachment,
  validateAttachmentSizes,
} from "@/lib/attachments";
import { attachFocusOnOpen } from "@/lib/focusOnAnimation";
import { useChatStore } from "@/stores/chat";
import { IoMark } from "./IoMark";
import { MessageBubble } from "./ui/MessageBubble";

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Attach focus handling that listens for animation/transition end and has a rAF+timeout fallback
    // Uses a shared util to make unit testing easier
    const cleanup = attachFocusOnOpen(overlayRef.current, textareaRef.current);
    return cleanup;
  }, [open]);

  useAutoScroll(messagesContainerRef, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;
    const text = input.trim();
    setInput("");
    const attachments = [...pendingAttachments];
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(text, attachments);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newAttachments: MessageAttachment[] = [];
    for (const file of Array.from(files)) {
      newAttachments.push(await fileToMessageAttachment(file));
    }
    const combined = [...pendingAttachments, ...newAttachments];
    const validated = validateAttachmentSizes(combined);
    if (validated.ok) {
      setPendingAttachments(combined);
    }
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
      {open && (
        <div
          ref={overlayRef}
          className="w-[340px] flex flex-col rounded-2xl overflow-hidden shadow-xl border border-white/[0.09] backdrop-blur-xs"
          style={{ height: "460px", background: "rgba(20, 20, 20, 0.95)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0"
            style={{ background: "var(--base-dark-gradient)" }}
          >
            <div className="flex items-center gap-2.5">
              <IoMark height={20} />
              <span
                className="text-xl text-white tracking-wider leading-none pt-1"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                IO
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/[0.07] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <MessageBubble msg={msg} />
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-white/[0.06] flex-shrink-0 space-y-2">
            {pendingAttachments.length > 0 && (
              <div className="flex items-center gap-2 bg-[#252525] border border-white/[0.08] rounded-xl px-3 py-2">
                <div className="w-9 h-6 rounded bg-[#2e2e2e] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3 h-3 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-zinc-300 truncate leading-tight">
                    {pendingAttachments[0].name}
                  </p>
                  <p className="text-[9px] font-mono text-zinc-600 leading-tight">
                    {formatAttachmentSize(pendingAttachments[0].size)}
                  </p>
                </div>
                <button
                  onClick={() => setPendingAttachments([])}
                  className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="bg-[var(--base-dark-gray)] border border-white/[0.08] rounded-xl flex items-end gap-1.5 px-2.5 py-2 focus-within:border-[var(--base-teal)]/30 transition-colors">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors flex-shrink-0 cursor-pointer"
                title="Attach file"
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
                style={{ minHeight: "18px", maxHeight: "100px", fontFamily: "Inter, sans-serif" }}
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && pendingAttachments.length === 0) || isStreaming}
                className="p-1.5 rounded-lg text-[#1F2833] disabled:opacity-25 disabled:cursor-not-allowed transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: "var(--base-teal)" }}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close chat" : "Quick chat"}
        className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
        style={
          open ? { background: "#252525", border: "1px solid var(--base-black)" } : { background: "var(--base-teal)" }
        }
      >
        {open ? <X className="w-4 h-4 text-zinc-400" /> : <MessageSquare className="w-4 h-4 text-[#1F2833]" />}
      </button>
    </div>
  );
}
