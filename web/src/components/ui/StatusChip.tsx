import type { ReactNode } from "react";

export type StatusKind = "connected" | "disconnected" | "done" | "error" | "idle" | "stopped" | "working" | "reviewing";
export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "muted";

export function StatusDot({ status }: { status: StatusKind }) {
  const color = {
    connected: "bg-green-500",
    idle: "bg-green-500",
    done: "bg-green-500",
    stopped: "bg-zinc-600",
    disconnected: "bg-zinc-600",
    error: "bg-red-500",
    working: "bg-amber-400",
    reviewing: "bg-blue-400",
  }[status];
  const pulse = status === "connected" || status === "working";
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2">
      {pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 animate-ping`} />}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

export function Chip({ children, variant = "muted" }: { children: ReactNode; variant?: BadgeVariant }) {
  const cls = {
    default: "bg-[#66FCF1]/15 text-[#D789F3] border-[#66FCF1]/20",
    success: "bg-green-500/15 text-green-400 border-green-500/20",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    error: "bg-red-500/15 text-red-400 border-red-500/20",
    info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    muted: "bg-white/5 text-zinc-400 border-white/10",
  }[variant];
  return (
    <span className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-mono border ${cls}`}>
      {children}
    </span>
  );
}

export function statusToVariant(s: string): BadgeVariant {
  if (s === "connected" || s === "idle" || s === "done") return "success";
  if (s === "working") return "warning";
  if (s === "reviewing") return "info";
  if (s === "error") return "error";
  if (s === "stopped") return "muted";
  return "muted";
}

const SQUAD_COLORS: Record<string, string> = {
  "Project Alpha": "#38bdf8",
  "Research Lab": "#a78bfa",
  "DevOps Core": "#34d399",
};

export function squadColor(name: string): string | undefined {
  return SQUAD_COLORS[name];
}

export function SquadChip({ name, color: colorProp }: { name: string; color?: string }) {
  const color = colorProp || squadColor(name);
  if (color) {
    return (
      <span
        className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-mono border"
        style={{ background: `${color}15`, color, borderColor: `${color}30` }}
      >
        {name}
      </span>
    );
  }
  return <Chip variant="muted">{name}</Chip>;
}
