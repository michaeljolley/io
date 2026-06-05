import { MarkdownRenderer } from "@/components/ui/markdown";
import { Chip } from "@/components/ui/shared";
import { useTimezone } from "@/hooks/use-config";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/timezone";
import type { InboxItem } from "@io/shared";
import { Eye, Inbox, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

// Squad color palette (matches SquadsView)
const SQUAD_COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#E43A9C"];

function hashColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return SQUAD_COLORS[Math.abs(hash) % SQUAD_COLORS.length]!;
}

function SourceChip({ name, color: colorProp }: { name: string; color?: string }) {
	const lower = name.toLowerCase();
	const color =
		colorProp ?? (lower === "orchestrator" || lower === "io" ? "#71717a" : hashColor(name));
	return (
		<span
			className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-mono border"
			style={{ background: `${color}15`, color, borderColor: `${color}30` }}
		>
			{name}
		</span>
	);
}

type FeedItem = InboxItem & {
	squadName?: string;
	squadColor?: string;
	kind?: string;
	response?: string | null;
};

function isUnread(item: FeedItem) {
	return item.status === "pending";
}

export function FeedView() {
	const [items, setItems] = useState<FeedItem[]>([]);
	const [reading, setReading] = useState<FeedItem | null>(null);
	const [checked, setChecked] = useState<Set<string>>(new Set());
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const timezone = useTimezone();

	useEffect(() => {
		api
			.get<{ entries?: FeedItem[] }>("/inbox")
			.then((d) => setItems(d.entries ?? []))
			.catch(() => {});
	}, []);

	const unreadCount = items.filter(isUnread).length;
	const filtered = filter === "unread" ? items.filter(isUnread) : items;
	const allChecked = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
	const anyChecked = checked.size > 0;

	function openItem(item: FeedItem) {
		if (anyChecked) return;
		setReading(item);
		if (isUnread(item)) {
			api.put(`/inbox/${item.id}/read`, {}).catch(() => {});
			setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "read" } : i)));
		}
	}

	function toggleCheck(e: React.MouseEvent, id: string) {
		e.stopPropagation();
		setChecked((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		if (allChecked) setChecked(new Set());
		else setChecked(new Set(filtered.map((i) => i.id)));
	}

	function markReadBulk() {
		const ids = Array.from(checked);
		void Promise.allSettled(ids.map((id) => api.put(`/inbox/${id}/read`, {})));
		setItems((p) => p.map((i) => (checked.has(i.id) ? { ...i, status: "read" } : i)));
		setChecked(new Set());
	}

	function deleteBulk() {
		const ids = Array.from(checked);
		void Promise.allSettled(ids.map((id) => api.delete(`/inbox/${id}`)));
		setItems((p) => p.filter((i) => !checked.has(i.id)));
		if (reading && checked.has(reading.id)) setReading(null);
		setChecked(new Set());
	}

	function deleteSingle(id: string) {
		api.delete(`/inbox/${id}`).catch(() => {});
		setItems((p) => p.filter((i) => i.id !== id));
		if (reading?.id === id) setReading(null);
	}

	return (
		<div className="flex flex-1 min-h-0 overflow-hidden">
			{/* Left list panel */}
			<div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
				{/* Header */}
				<div className="px-4 py-3 border-b border-white/[0.06] flex-shrink-0 space-y-2">
					<div className="flex items-center justify-between">
						<span
							className="text-lg tracking-wide text-zinc-200"
							style={{ fontFamily: "'Bebas Neue', sans-serif" }}
						>
							Inbox
						</span>
						{unreadCount > 0 && <Chip variant="default">{unreadCount} unread</Chip>}
					</div>
					<div className="flex gap-1">
						{(["all", "unread"] as const).map((f) => (
							<button
								key={f}
								type="button"
								onClick={() => {
									setFilter(f);
									setChecked(new Set());
								}}
								className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition-colors cursor-pointer ${
									filter === f ? "text-[#E43A9C]" : "text-zinc-600 hover:text-zinc-300"
								}`}
								style={filter === f ? { background: "rgba(228,58,156,0.12)" } : undefined}
							>
								{f}
							</button>
						))}
					</div>
				</div>

				{/* Bulk action bar */}
				{anyChecked && (
					<div
						className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-1.5 flex-shrink-0"
						style={{ background: "rgba(228,58,156,0.06)" }}
					>
						<span className="text-[10px] font-mono text-zinc-500 flex-1">
							{checked.size} selected
						</span>
						<button
							type="button"
							onClick={markReadBulk}
							className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
						>
							<Eye className="w-3 h-3" />
							Mark read
						</button>
						<button
							type="button"
							onClick={deleteBulk}
							className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
						>
							<Trash2 className="w-3 h-3" />
							Delete
						</button>
					</div>
				)}

				{/* Select-all row */}
				{filtered.length > 0 && (
					<div className="px-4 py-1.5 border-b border-white/[0.04] flex items-center gap-2 flex-shrink-0">
						<button
							type="button"
							onClick={toggleAll}
							className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
								allChecked
									? "border-[#E43A9C] bg-[#E43A9C]"
									: "border-white/20 hover:border-white/40"
							}`}
						>
							{allChecked && (
								<svg
									className="w-2 h-2 text-white"
									fill="none"
									viewBox="0 0 8 8"
									aria-hidden="true"
								>
									<path
										d="M1 4l2 2 4-4"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</button>
						<span className="text-[10px] font-mono text-zinc-700">Select all</span>
					</div>
				)}

				{/* List */}
				<div className="flex-1 overflow-y-auto">
					{filtered.map((item) => {
						const isChecked = checked.has(item.id);
						const isReading = reading?.id === item.id && !anyChecked;
						return (
							<div
								key={item.id}
								onClick={() => openItem(item)}
								onKeyDown={(e) => e.key === "Enter" && openItem(item)}
								className={`flex items-start gap-2.5 px-3 py-3 border-b border-white/[0.04] cursor-pointer transition-colors ${
									isReading ? "border-l-2 border-l-[#E43A9C] pl-2.5" : "hover:bg-white/[0.025]"
								} ${isChecked ? "bg-[#E43A9C]/5" : ""}`}
								style={isReading ? { background: "rgba(228,58,156,0.05)" } : undefined}
							>
								{/* Checkbox */}
								<button
									type="button"
									onClick={(e) => toggleCheck(e, item.id)}
									className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
										isChecked
											? "border-[#E43A9C] bg-[#E43A9C]"
											: "border-white/20 hover:border-white/50"
									}`}
								>
									{isChecked && (
										<svg
											className="w-2 h-2 text-white"
											fill="none"
											viewBox="0 0 8 8"
											aria-hidden="true"
										>
											<path
												d="M1 4l2 2 4-4"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									)}
								</button>

								{/* Content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-1.5 mb-0.5">
										{isUnread(item) && (
											<div className="w-1 h-1 rounded-full bg-[#E43A9C] flex-shrink-0" />
										)}
										<SourceChip
											name={
												item.squadName ?? (item.squadId ? item.squadId.slice(0, 8) : "Orchestrator")
											}
											color={item.squadColor}
										/>
									</div>
									<p
										className={`text-[11px] truncate ${isUnread(item) ? "text-zinc-200" : "text-zinc-500"}`}
									>
										{item.title}
									</p>
									<p className="text-[10px] text-zinc-700 font-mono mt-1">
										{formatDateTime(item.createdAt, timezone)}
									</p>
								</div>
							</div>
						);
					})}
					{filtered.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12">
							<Inbox size={32} className="text-zinc-800 mb-2" />
							<p className="text-[11px] font-mono text-zinc-700">
								{filter === "unread" ? "All caught up" : "No items yet"}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Right reading panel */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{reading && !anyChecked ? (
					<>
						<div className="px-6 py-4 border-b border-white/[0.06] flex items-start justify-between flex-shrink-0">
							<div className="flex-1 min-w-0 mr-4">
								<SourceChip
									name={
										reading.squadName ??
										(reading.squadId ? reading.squadId.slice(0, 8) : "Orchestrator")
									}
									color={reading.squadColor}
								/>
								<h3 className="text-sm font-mono text-zinc-100 mt-1.5">{reading.title}</h3>
								<p className="text-[11px] text-zinc-700 font-mono mt-0.5">
									{formatDateTime(reading.createdAt, timezone)}
								</p>
							</div>
							<button
								type="button"
								onClick={() => deleteSingle(reading.id)}
								className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] text-zinc-400 bg-[#252525] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
							>
								<Trash2 className="w-3 h-3" />
								Delete
							</button>
						</div>
						<div className="flex-1 overflow-y-auto px-6 py-5">
							<MarkdownRenderer content={reading.content} />
						</div>
					</>
				) : anyChecked ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
						<div
							className="w-10 h-10 rounded-2xl flex items-center justify-center border border-[#E43A9C]/20"
							style={{ background: "rgba(228,58,156,0.08)" }}
						>
							<Inbox className="w-4 h-4 text-[#E43A9C]" />
						</div>
						<div>
							<p className="text-sm font-mono text-zinc-300">
								{checked.size} message{checked.size !== 1 ? "s" : ""} selected
							</p>
							<p className="text-[11px] text-zinc-600 mt-1">
								Use the actions above to mark as read or delete
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={markReadBulk}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-zinc-300 border border-white/[0.1] hover:bg-white/[0.05] transition-colors cursor-pointer"
							>
								<Eye className="w-3 h-3" />
								Mark read
							</button>
							<button
								type="button"
								onClick={deleteBulk}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer"
							>
								<Trash2 className="w-3 h-3" />
								Delete selected
							</button>
						</div>
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center text-zinc-700 font-mono text-xs">
						Select an item to read
					</div>
				)}
			</div>
		</div>
	);
}
