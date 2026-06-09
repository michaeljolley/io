import type { ChatMessage } from "@/stores/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { UserIndicator } from "./UserIndicator";

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  return msg.content.trim() === "" && msg.attachments.length === 0 ? (
    <div className="flex gap-2">
      <div className="flex-shrink-0 w-5 h-5 rounded-lg flex items-center justify-center bg-[#282828] border border-white/[0.07] mt-0.5">
        <UserIndicator role={msg.role} />
      </div>
      <div className="bg-[#282828] border border-white/[0.06] rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        {[0, 110, 220].map((d) => (
          <span
            key={d}
            className="w-1 h-1 rounded-full bg-[#66FCF1] animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  ) : (
    <div className={`flex gap-3 max-w-[82%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
      <UserIndicator role={msg.role} />
      <div
        className={`rounded-xl px-3 py-2 text-xs leading-relaxed border ${msg.role === "user" ? "text-[#1F2833]  border-[#66FCF1]/30  rounded-tr-sm" : "bg-[#282828] border-white/[0.06] text-zinc-200 rounded-tl-sm"}`}
        style={msg.role === "user" ? { background: "var(--base-dark-teal)", color: "var(--base-teal)" } : undefined}
      >
        <MarkdownRenderer content={msg.content} className="max-w-none text-[11px] leading-relaxed text-inherit" />
      </div>
    </div>
  );
}
