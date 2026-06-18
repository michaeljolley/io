import { IoMark } from "../IoMark";

export function UserIndicator({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[13px] font-mono mt-0.5 ${role === "user" ? "border border-[#66FCF1]/30 text-[#66FCF1]" : "bg-[#282828] border border-white/[0.07] text-zinc-500"}`}
      style={role === "user" ? { background: "rgba(69,162,158,0.12)" } : undefined}
    >
      {role === "user" ? "U" : <IoMark height={12} />}
    </div>
  );
}
