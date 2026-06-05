import {
	Chip,
	DangerBtn,
	PrimaryBtn,
	SecondaryBtn,
	SquadChip,
	WarnBtn,
} from "@/components/ui/shared";
import { useTimezone } from "@/hooks/use-config";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/timezone";
import {
	Activity,
	ChevronLeft,
	Clock,
	Edit2,
	Pause,
	Play,
	Plus,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Schedule {
	id: string;
	name: string;
	targetType: "squad" | "orchestrator";
	targetId: string | null;
	cron: string;
	prompt: string;
	enabled: boolean;
	lastRun: string | null;
	nextRun: string | null;
}

type SchedKind = "squad" | "io";

const FI =
	"w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#E43A9C]/40 focus:ring-1 focus:ring-[#E43A9C]/10 transition-colors";
const FI_S =
	"bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#E43A9C]/40 focus:ring-1 focus:ring-[#E43A9C]/10 transition-colors";

function FormRow({
	label,
	hint,
	align = "center",
	children,
}: {
	label: string;
	hint?: string;
	align?: "center" | "start";
	children: React.ReactNode;
}) {
	const rightClass = align === "start" ? "flex-1 min-w-0" : "flex-1 flex justify-end items-center";
	return (
		<div
			className={`glass-card border border-white/[0.07] rounded-2xl px-4 py-3.5 flex gap-4 ${align === "start" ? "items-start" : "items-center"}`}
		>
			<div className="w-[140px] shrink-0">
				<span className="text-[11px] font-mono text-zinc-400">{label}</span>
				{hint && <span className="text-[10px] font-mono text-zinc-700 ml-1.5">({hint})</span>}
			</div>
			<div className={rightClass}>{children}</div>
		</div>
	);
}

// ─── New Schedule Modal ───────────────────────────────────────────────────────

function SchedEditor({
	onSave,
	onCancel,
	squads,
}: {
	onSave: (data: {
		name: string;
		targetType: "squad" | "orchestrator";
		targetId?: string;
		cron: string;
		prompt: string;
	}) => void;
	onCancel: () => void;
	squads: { id: string; name: string }[];
}) {
	const [kind, setKind] = useState<SchedKind>("io");
	const [squadId, setSquadId] = useState(squads[0]?.id ?? "");
	const [name, setName] = useState("");
	const [cron, setCron] = useState("");
	const [prompt, setPrompt] = useState("");

	const save = () => {
		if (!cron.trim() || !prompt.trim() || !name.trim()) return;
		onSave({
			name: name.trim(),
			targetType: kind === "io" ? "orchestrator" : "squad",
			targetId: kind === "squad" ? squadId : undefined,
			cron: cron.trim(),
			prompt: prompt.trim(),
		});
	};

	return (
		<div
			className="fixed inset-0 z-40 flex items-center justify-center p-6"
			style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
		>
			<div
				className="glass-card border border-white/[0.09] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col"
				style={{ maxHeight: "90vh" }}
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
					<h3
						className="text-lg tracking-wide text-zinc-100"
						style={{ fontFamily: "'Bebas Neue', sans-serif" }}
					>
						New Schedule
					</h3>
					<button
						type="button"
						onClick={onCancel}
						className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
					<FormRow label="Name">
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Daily triage"
							className={`${FI_S} w-48`}
						/>
					</FormRow>

					<FormRow label="Type">
						<div className="flex gap-2">
							{(["io", "squad"] as SchedKind[]).map((k) => (
								<button
									key={k}
									type="button"
									onClick={() => setKind(k)}
									className={`px-4 py-1.5 rounded-xl text-[11px] font-mono capitalize transition-colors border cursor-pointer ${
										kind === k
											? "text-[#E43A9C] border-[#E43A9C]/30"
											: "text-zinc-500 border-white/[0.08] hover:text-zinc-300 hover:bg-white/[0.04]"
									}`}
									style={kind === k ? { background: "rgba(228,58,156,0.08)" } : undefined}
								>
									{k === "io" ? "IO" : "Squad"}
								</button>
							))}
						</div>
					</FormRow>

					{kind === "squad" && (
						<FormRow label="Squad">
							<select
								value={squadId}
								onChange={(e) => setSquadId(e.target.value)}
								className={`${FI_S} w-48`}
							>
								{squads.map((s) => (
									<option
										key={s.id}
										value={s.id}
										style={{ background: "#1a1a1a", color: "#d4d4d8" }}
									>
										{s.name}
									</option>
								))}
							</select>
						</FormRow>
					)}

					<FormRow label="Cron Expression">
						<input
							value={cron}
							onChange={(e) => setCron(e.target.value)}
							placeholder="0 9 * * 1-5"
							className={`${FI_S} w-40`}
						/>
					</FormRow>

					<FormRow label="Prompt" hint="supports Markdown" align="start">
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Describe what IO or the squad should do when this schedule fires."
							rows={8}
							className={`${FI} resize-none leading-relaxed`}
						/>
					</FormRow>
				</div>

				<div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/[0.06] flex-shrink-0">
					<SecondaryBtn onClick={onCancel}>Cancel</SecondaryBtn>
					<PrimaryBtn onClick={save} className="px-4 py-1.5">
						<Save className="w-3 h-3" />
						Create Schedule
					</PrimaryBtn>
				</div>
			</div>
		</div>
	);
}

// ─── Edit Schedule Page ───────────────────────────────────────────────────────

function SchedEditPage({
	sched,
	squads,
	onSave,
	onBack,
}: {
	sched: Schedule;
	squads: { id: string; name: string }[];
	onSave: (updates: Partial<Schedule>) => void;
	onBack: () => void;
}) {
	const [name, setName] = useState(sched.name);
	const [cron, setCron] = useState(sched.cron);
	const [prompt, setPrompt] = useState(sched.prompt);
	const [targetId, setTargetId] = useState(sched.targetId ?? squads[0]?.id ?? "");

	const save = () => {
		if (!cron.trim() || !prompt.trim() || !name.trim()) return;
		onSave({
			name: name.trim(),
			cron: cron.trim(),
			prompt: prompt.trim(),
			targetId: sched.targetType === "squad" ? targetId : undefined,
		});
	};

	const typeLabel =
		sched.targetType === "orchestrator"
			? "IO Schedule"
			: `Squad — ${squads.find((s) => s.id === sched.targetId)?.name ?? "Unknown"}`;

	return (
		<div className="flex-1 overflow-y-auto p-6 max-w-3xl">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 mb-6">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
				>
					<ChevronLeft className="w-3.5 h-3.5" />
					Schedules
				</button>
				<span className="text-zinc-700 text-[11px]">/</span>
				<span className="text-[11px] font-mono text-zinc-400">Edit</span>
			</div>

			<div className="flex items-start justify-between mb-6">
				<div>
					<h2
						className="text-2xl tracking-wide text-zinc-100"
						style={{ fontFamily: "'Bebas Neue', sans-serif" }}
					>
						Edit Schedule
					</h2>
					<p className="text-[11px] font-mono text-zinc-600 mt-0.5">{typeLabel}</p>
				</div>
				<div className="flex items-center gap-2">
					<SecondaryBtn onClick={onBack}>Cancel</SecondaryBtn>
					<PrimaryBtn onClick={save} className="px-4 py-1.5">
						<Save className="w-3 h-3" />
						Save Changes
					</PrimaryBtn>
				</div>
			</div>

			<div className="space-y-3">
				<FormRow label="Name">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Schedule name"
						className={`${FI_S} w-48`}
					/>
				</FormRow>

				{sched.targetType === "squad" && (
					<FormRow label="Squad">
						<select
							value={targetId}
							onChange={(e) => setTargetId(e.target.value)}
							className={`${FI_S} w-48`}
						>
							{squads.map((s) => (
								<option key={s.id} value={s.id} style={{ background: "#1a1a1a", color: "#d4d4d8" }}>
									{s.name}
								</option>
							))}
						</select>
					</FormRow>
				)}

				<FormRow label="Cron Expression">
					<input
						value={cron}
						onChange={(e) => setCron(e.target.value)}
						placeholder="0 9 * * 1-5"
						className={`${FI_S} w-40`}
					/>
				</FormRow>

				<FormRow label="Prompt" hint="supports Markdown" align="start">
					<div className="space-y-1.5">
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Describe what IO or the squad should do when this schedule fires."
							className={`${FI} leading-relaxed resize-y`}
							style={{ minHeight: "360px" }}
						/>
						<p className="text-[10px] font-mono text-zinc-700">
							Tip: use # headings and - lists to structure multi-step instructions.
						</p>
					</div>
				</FormRow>
			</div>
		</div>
	);
}

// ─── Main Schedules View ──────────────────────────────────────────────────────

export function SchedulesView() {
	const [tab, setTab] = useState<SchedKind>("squad");
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [squads, setSquads] = useState<{ id: string; name: string; color?: string }[]>([]);
	const [addingNew, setAddingNew] = useState(false);
	const [editingSched, setEditingSched] = useState<Schedule | null>(null);
	const timezone = useTimezone();

	useEffect(() => {
		loadSchedules();
		loadSquads();
	}, []);

	function loadSchedules() {
		api
			.get<{ schedules: Schedule[] }>("/schedules")
			.then((d) => setSchedules(d.schedules))
			.catch(() => {});
	}

	function loadSquads() {
		api
			.get<{ squads: { id: string; name: string }[] }>("/squads")
			.then((d) => setSquads(d.squads))
			.catch(() => {});
	}

	const squadScheds = schedules.filter((s) => s.targetType === "squad");
	const ioScheds = schedules.filter((s) => s.targetType === "orchestrator");
	const rows = tab === "squad" ? squadScheds : ioScheds;

	async function handleCreate(data: {
		name: string;
		targetType: "squad" | "orchestrator";
		targetId?: string;
		cron: string;
		prompt: string;
	}) {
		try {
			await api.post("/schedules", data);
			toast.success("Schedule created");
			setAddingNew(false);
			loadSchedules();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create");
		}
	}

	async function handleSaveEdit(updates: Partial<Schedule>) {
		if (!editingSched) return;
		try {
			await api.patch(`/schedules/${editingSched.id}`, updates);
			toast.success("Schedule saved");
			setEditingSched(null);
			loadSchedules();
		} catch {
			toast.error("Failed to save schedule");
		}
	}

	const [actionPending, setActionPending] = useState<string | null>(null);

	async function togglePause(id: string, enabled: boolean) {
		setActionPending(id);
		try {
			await api.patch(`/schedules/${id}`, { enabled: !enabled });
			toast.success(enabled ? "Schedule paused" : "Schedule resumed");
			loadSchedules();
		} catch {
			toast.error("Failed to toggle schedule");
		} finally {
			setActionPending(null);
		}
	}

	async function runNow(id: string) {
		setActionPending(id);
		try {
			await api.post(`/schedules/${id}/run`, {});
			toast.success("Schedule triggered");
		} catch {
			toast.error("Failed to trigger schedule");
		} finally {
			setActionPending(null);
		}
	}

	async function deleteSchedule(id: string) {
		setActionPending(id);
		try {
			await api.delete(`/schedules/${id}`);
			toast.success("Schedule deleted");
			loadSchedules();
		} catch {
			toast.error("Failed to delete");
		} finally {
			setActionPending(null);
		}
	}

	// Edit page
	if (editingSched) {
		return (
			<SchedEditPage
				sched={editingSched}
				squads={squads}
				onSave={handleSaveEdit}
				onBack={() => setEditingSched(null)}
			/>
		);
	}

	const cols =
		tab === "squad"
			? ["Squad", "Name", "Cron", "Next Run", "Status", ""]
			: ["Name", "Cron", "Next Run", "Status", ""];

	return (
		<div className="flex-1 overflow-y-auto p-6">
			{addingNew && (
				<SchedEditor onSave={handleCreate} onCancel={() => setAddingNew(false)} squads={squads} />
			)}

			<div className="flex items-center justify-between mb-5">
				<div>
					<h2
						className="text-2xl tracking-wide text-zinc-100"
						style={{ fontFamily: "'Bebas Neue', sans-serif" }}
					>
						Schedules
					</h2>
					<p className="text-[11px] text-zinc-600 font-mono mt-0.5">
						{schedules.filter((s) => s.enabled).length} active ·{" "}
						{schedules.filter((s) => !s.enabled).length} paused
					</p>
				</div>
				<PrimaryBtn onClick={() => setAddingNew(true)} className="px-3 py-1.5">
					<Plus className="w-3.5 h-3.5" />
					Add Schedule
				</PrimaryBtn>
			</div>

			<div className="flex gap-1 mb-4">
				{(
					[
						["squad", "Squad Schedules"],
						["io", "IO Schedules"],
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						onClick={() => setTab(key)}
						className={`px-4 py-2 text-[11px] font-mono rounded-xl transition-colors cursor-pointer ${
							tab === key
								? "text-[#E43A9C]"
								: "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
						}`}
						style={tab === key ? { background: "rgba(228,58,156,0.12)" } : undefined}
					>
						{label}
					</button>
				))}
			</div>

			<div className="overflow-x-auto rounded-2xl border border-white/[0.07] glass-card">
				{rows.length === 0 ? (
					<div className="px-4 py-12 text-center text-zinc-600 font-mono text-sm">
						No schedules for this category
					</div>
				) : (
					<table className="w-full text-[11px] font-mono min-w-[640px]">
						<thead>
							<tr
								className="border-b border-white/[0.06]"
								style={{ background: "rgba(20,20,20,0.6)" }}
							>
								{cols.map((h) => (
									<th key={h} className="text-left px-4 py-2.5 text-zinc-600 font-medium">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((s) => (
								<tr
									key={s.id}
									className={`border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors ${!s.enabled ? "opacity-50" : ""}`}
								>
									{tab === "squad" ? (
										<td className="px-4 py-3">
											<SquadChip
												name={squads.find((sq) => sq.id === s.targetId)?.name ?? "Unknown"}
												color={squads.find((sq) => sq.id === s.targetId)?.color}
											/>
										</td>
									) : null}
									<td className="px-4 py-3 text-zinc-300">{s.name}</td>
									<td className="px-4 py-3 text-zinc-600 text-[10px]">{s.cron}</td>
									<td className="px-4 py-3 text-zinc-600">
										<span className="flex items-center gap-1">
											<Clock className="w-3 h-3" />
											{!s.enabled ? "—" : s.nextRun ? formatDateTime(s.nextRun, timezone) : "—"}
										</span>
									</td>
									<td className="px-4 py-3">
										<Chip variant={!s.enabled ? "muted" : "success"}>
											{!s.enabled ? "paused" : "active"}
										</Chip>
									</td>
									<td className="px-4 py-3">
										<div
											className={`flex items-center gap-1 ${actionPending === s.id ? "opacity-50 pointer-events-none" : ""}`}
										>
											<SecondaryBtn onClick={() => runNow(s.id)}>
												<Play className="w-3 h-3" />
												Run now
											</SecondaryBtn>
											<WarnBtn onClick={() => togglePause(s.id, s.enabled)}>
												{s.enabled ? (
													<>
														<Pause className="w-3 h-3" />
														Pause
													</>
												) : (
													<>
														<Activity className="w-3 h-3" />
														Resume
													</>
												)}
											</WarnBtn>
											<SecondaryBtn onClick={() => setEditingSched(s)}>
												<Edit2 className="w-3 h-3" />
												Edit
											</SecondaryBtn>
											<DangerBtn onClick={() => deleteSchedule(s.id)}>
												<Trash2 className="w-3 h-3" />
												Delete
											</DangerBtn>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
