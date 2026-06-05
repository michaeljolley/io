import type React from "react";

type StatusKind = "connected" | "disconnected" | "error" | "idle" | "working" | "reviewing";
type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "muted";

export function StatusDot({ status }: { status: StatusKind }) {
	const color = {
		connected: "bg-green-500",
		idle: "bg-green-500",
		disconnected: "bg-zinc-600",
		error: "bg-red-500",
		working: "bg-amber-400",
		reviewing: "bg-blue-400",
	}[status];
	const pulse = status === "connected" || status === "working";
	return (
		<span className="relative inline-flex items-center justify-center w-2 h-2">
			{pulse && (
				<span
					className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 animate-ping`}
				/>
			)}
			<span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
		</span>
	);
}

export function Chip({
	children,
	variant = "muted",
	className = "",
}: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
	const cls = {
		default: "bg-[#E43A9C]/15 text-[#F041FF] border-[#E43A9C]/20",
		success: "bg-green-500/15 text-green-400 border-green-500/20",
		warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
		error: "bg-red-500/15 text-red-400 border-red-500/20",
		info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
		muted: "bg-white/5 text-zinc-400 border-white/10",
	}[variant];
	return (
		<span
			className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-mono border ${cls} ${className}`}
		>
			{children}
		</span>
	);
}

export function SquadChip({ name, color }: { name: string; color?: string }) {
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

export function PrimaryBtn({
	children,
	onClick,
	className = "",
	type = "button",
	disabled = false,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	className?: string;
	type?: "button" | "submit";
	disabled?: boolean;
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`flex items-center gap-1.5 font-mono text-[11px] text-white rounded-lg active:opacity-80 primary-btn cursor-pointer disabled:opacity-50 ${className}`}
		>
			{children}
		</button>
	);
}

export function SecondaryBtn({
	children,
	onClick,
	className = "",
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] text-zinc-400 bg-[#252525] hover:bg-[#2e2e2e] hover:text-zinc-100 transition-colors cursor-pointer ${className}`}
		>
			{children}
		</button>
	);
}

export function DangerBtn({
	children,
	onClick,
	className = "",
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] text-zinc-400 bg-[#252525] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer ${className}`}
		>
			{children}
		</button>
	);
}

export function WarnBtn({
	children,
	onClick,
	className = "",
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] text-zinc-400 bg-[#252525] hover:bg-amber-500/10 hover:text-amber-400 transition-colors cursor-pointer ${className}`}
		>
			{children}
		</button>
	);
}

export function statusToVariant(s: string): BadgeVariant {
	if (s === "connected" || s === "idle") return "success";
	if (s === "active" || s === "working") return "warning";
	if (s === "reviewing" || s === "in meeting" || s === "planning" || s === "meeting") return "info";
	if (s === "error" || s === "failed") return "error";
	return "muted";
}
