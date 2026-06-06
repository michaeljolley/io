import { MarkdownRenderer } from "@/components/ui/markdown";
import { Chip, statusToVariant } from "@/components/ui/shared";
import { useTimezone } from "@/hooks/use-config";
import { type WsMessage, useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/timezone";
import type { Squad as SharedSquad, SquadMember as SharedSquadMember } from "@io/shared";
import {
	Activity,
	AlertTriangle,
	ArrowDown,
	Bot,
	Bug,
	CheckCircle,
	ChevronLeft,
	Clock,
	Cpu,
	Crown,
	ExternalLink,
	Hash,
	Info,
	Loader,
	MessageSquare,
	Pencil,
	Save,
	ScrollText,
	Square,
	Terminal,
	Users,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

interface ActivityItem {
	id: string;
	status: string;
	objective: string | null;
	issueRef: string | null;
	timestamp: string;
}

interface SquadSummary extends SharedSquad {
	color?: string;
	memberCount: number;
	activeInstances: number;
	totalInstances: number;
	recentActivity: ActivityItem[];
}

interface AppConfig {
	maxInstancesPerSquad: number;
}

interface SquadMember extends Pick<SharedSquadMember, "id" | "name" | "role"> {
	displayName: string;
	roleName?: string;
	veto: boolean;
	status: string;
	currentTask: string | null;
	tools?: string[];
}

interface InstanceSummary {
	id: string;
	status: string;
	issueRef: string | null;
	branch: string | null;
	taskCount: number;
	tasksComplete: number;
}

interface SquadDetail {
	squad: SharedSquad & {
		color?: string;
		autonomyTier?: string;
	};
	members: SquadMember[];
	instances: InstanceSummary[];
}

interface InstanceTask {
	id: string;
	description: string;
	assignedTo: string;
	status: string;
}

interface AgentActivityEvent {
	id: string;
	agent: string;
	type: string;
	content: string;
	toolName: string | null;
	success: boolean | null;
	model: string | null;
	tokensUsed: number | null;
	timestamp: string;
}

interface InstanceDetail {
	squadColor?: string;
	instance: {
		id: string;
		status: string;
		branch: string | null;
		issueRef: string | null;
		taskCount: number;
		tasksComplete: number;
		tasks: InstanceTask[];
		meetingLog?: string[];
	};
	members: SquadMember[];
	activity: AgentActivityEvent[];
}

interface HistoryActivity {
	id: string;
	title: string;
	type: string;
	status: string;
	createdAt: string;
	completedAt: string;
	duration: string;
	agentCount: number;
}

interface HistoryWorkEvent {
	id: number;
	kind: string;
	timestamp: string;
	label: string | null;
	content: string;
	status: string | null;
}

interface HistoryAgentEntry {
	agentId: string;
	agentName: string;
	role: string;
	roleType: string;
	summary: string;
	events: HistoryWorkEvent[];
}

interface HistoryActivityDetail extends HistoryActivity {
	agentEntries: HistoryAgentEntry[];
}

interface SquadSchedule {
	id: string;
	name: string;
	cron: string;
	enabled: boolean;
	nextRun: string | null;
	prompt: string;
}

/**
 * Generate a deterministic HSL color from a string (agent name).
 * Produces visually distinct, readable colors on dark backgrounds.
 */
function agentColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = ((hash % 360) + 360) % 360;
	return `hsl(${hue}, 70%, 65%)`;
}

export function SquadsView() {
	const { name, instanceId, role } = useParams<{
		name: string;
		instanceId: string;
		role: string;
	}>();

	if (name && role) {
		return <AgentDetailView squadName={name} role={role} />;
	}

	if (name && instanceId) {
		return <InstanceDetailView squadName={name} instanceId={instanceId} />;
	}

	if (name) {
		return <SquadDetailView name={name} />;
	}

	return <SquadListView />;
}

function SquadListView() {
	const [squads, setSquads] = useState<SquadSummary[]>([]);
	const [maxInstancesPerSquad, setMaxInstancesPerSquad] = useState<number | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		Promise.all([
			api.get<{ squads: SquadSummary[] }>("/squads"),
			api.get<{ config: AppConfig }>("/config"),
		])
			.then(([squadsResponse, configResponse]) => {
				setSquads(squadsResponse.squads);
				setMaxInstancesPerSquad(configResponse.config.maxInstancesPerSquad);
			})
			.catch(() => {});
	}, []);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="mb-6">
				<div>
					<h2
						className="text-2xl tracking-wide text-zinc-100"
						style={{ fontFamily: "'Bebas Neue', sans-serif" }}
					>
						Squads
					</h2>
					<p className="text-[11px] text-zinc-600 font-mono mt-0.5">
						{squads.length} squads · {squads.reduce((a, s) => a + (s.activeInstances || 0), 0)}{" "}
						active instances
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
				{squads.map((squad) => {
					const color = squad.color || "#38bdf8";
					return (
						<button
							type="button"
							key={squad.id}
							onClick={() => navigate(`/squads/${squad.name}`)}
							className="text-left rounded-2xl p-5 transition-all group cursor-pointer"
							style={{
								border: `1px solid ${color}30`,
								background: `${color}08`,
								backdropFilter: "blur(20px)",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.borderColor = `${color}70`;
								e.currentTarget.style.background = `${color}12`;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.borderColor = `${color}30`;
								e.currentTarget.style.background = `${color}08`;
							}}
						>
							<div className="flex items-start justify-between mb-1">
								<h3 className="text-sm font-mono transition-colors" style={{ color }}>
									{squad.name}
								</h3>
								<Chip variant={statusToVariant(squad.status)}>{squad.status}</Chip>
							</div>
							<div className="flex items-center justify-between mb-3">
								<p className="text-[11px] text-zinc-600 font-mono">
									{squad.config?.prMode ?? "draft-pr"}
								</p>
								<span className="text-[11px] text-zinc-600 font-mono flex items-center gap-1">
									<Cpu className="w-3 h-3" />
									{squad.activeInstances}/
									{maxInstancesPerSquad ?? (squad.totalInstances || squad.memberCount)}
								</span>
							</div>
							{squad.repoUrl && (
								<div className="flex items-center gap-1.5 text-[11px] text-zinc-700 font-mono mb-4">
									<ExternalLink className="w-3 h-3 flex-shrink-0" />
									<span className="truncate">
										{squad.repoUrl.replace("https://github.com/", "")}
									</span>
								</div>
							)}
							{squad.recentActivity && squad.recentActivity.length > 0 && (
								<div className="border-t pt-3" style={{ borderColor: `${color}15` }}>
									<p
										className="text-[10px] font-mono uppercase tracking-wider mb-2"
										style={{ color: `${color}80` }}
									>
										Recent Work
									</p>
									<ul className="space-y-1.5">
										{squad.recentActivity.map((a) => {
											const iconProps = { className: "w-3.5 h-3.5 flex-shrink-0 mt-px" };
											const icon = activityIcon(a.status, iconProps);
											const label = a.objective
												? a.objective.length > 60
													? `${a.objective.slice(0, 60)}…`
													: a.objective
												: a.issueRef || "Instance";
											return (
												<li
													key={a.id}
													className="flex items-start gap-1.5 text-[11px] font-mono text-zinc-600"
												>
													{icon}
													<span className="truncate">{label}</span>
												</li>
											);
										})}
									</ul>
								</div>
							)}
						</button>
					);
				})}

				{squads.length === 0 && (
					<div className="col-span-full text-center py-12 text-zinc-600">
						<Users size={48} className="mx-auto mb-3 opacity-30" />
						<p className="text-[11px] font-mono">
							No squads hired yet. Ask IO to hire a squad for a project.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function activityIcon(type: string, iconProps: { className: string }) {
	const t = type.toLowerCase();
	if (t.includes("complete") || t.includes("success") || t.includes("done"))
		return <CheckCircle {...iconProps} style={{ color: "#34d399" }} />;
	if (t.includes("warning") || t.includes("review"))
		return <AlertTriangle {...iconProps} style={{ color: "#fbbf24" }} />;
	if (t.includes("error") || t.includes("fail"))
		return <XCircle {...iconProps} style={{ color: "#f87171" }} />;
	if (t.includes("working") || t.includes("progress") || t.includes("running"))
		return <Loader {...iconProps} style={{ color: "#E43A9C" }} />;
	return <Info {...iconProps} style={{ color: "#60a5fa" }} />;
}

function roleIcon(roleName: string, color: string) {
	const cls = "w-4 h-4";
	const style = { color };
	const lower = roleName.toLowerCase();
	if (lower.includes("lead") || lower.includes("pm") || lower.includes("technical"))
		return <Crown className={cls} style={style} />;
	if (lower.includes("qa") || lower.includes("test")) return <Bug className={cls} style={style} />;
	if (lower.includes("scribe")) return <ScrollText className={cls} style={style} />;
	return <Bot className={cls} style={style} />;
}

function SquadDetailView({ name }: { name: string }) {
	const [detail, setDetail] = useState<SquadDetail | null>(null);
	const [tab, setTab] = useState<"agents" | "instances" | "schedules" | "history">("agents");
	const [historyItems, setHistoryItems] = useState<HistoryActivity[]>([]);
	const [historyTotal, setHistoryTotal] = useState(0);
	const [selectedActivity, setSelectedActivity] = useState<HistoryActivityDetail | null>(null);
	const [schedules, setSchedules] = useState<SquadSchedule[]>([]);
	const navigate = useNavigate();
	const timezone = useTimezone();

	useEffect(() => {
		api
			.get<SquadDetail>(`/squads/${name}`)
			.then(setDetail)
			.catch(() => {});
	}, [name]);

	useEffect(() => {
		if (tab === "history") {
			api
				.get<{ items: HistoryActivity[]; total: number }>(`/squads/${name}/history`)
				.then((res) => {
					setHistoryItems(res.items);
					setHistoryTotal(res.total);
				})
				.catch(() => {});
		}
		if (tab === "schedules" && detail) {
			api
				.get<{ schedules: SquadSchedule[] }>(`/schedules?targetId=${detail.squad.id}`)
				.then((res) => setSchedules(res.schedules))
				.catch(() => {});
		}
	}, [tab, name, detail]);

	const drillIntoActivity = (activity: HistoryActivity) => {
		api
			.get<HistoryActivityDetail>(`/squads/${name}/history/${activity.id}`)
			.then(setSelectedActivity)
			.catch(() => toast.error("Failed to load activity detail"));
	};

	if (!detail) {
		return <div className="h-full flex items-center justify-center text-zinc-600">Loading...</div>;
	}

	const color = detail.squad.color || "#38bdf8";

	if (selectedActivity) {
		return (
			<ActivityDetailView
				activity={selectedActivity}
				squadColor={color}
				squadName={detail.squad.name}
				onBack={() => setSelectedActivity(null)}
			/>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6" style={{ background: `${color}06` }}>
			<button
				type="button"
				onClick={() => navigate("/squads")}
				className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 font-mono mb-5 transition-colors"
			>
				<ChevronLeft className="w-3.5 h-3.5" /> All Squads
			</button>

			<div className="flex items-start justify-between mb-5">
				<div>
					<h2
						className="text-3xl tracking-wide"
						style={{ fontFamily: "'Bebas Neue', sans-serif", color }}
					>
						{detail.squad.name}
					</h2>
					<p className="text-[11px] text-zinc-600 font-mono">
						{detail.squad.config?.prMode ?? "draft-pr"} · {detail.squad.autonomyTier || "standard"}{" "}
						autonomy
					</p>
					{detail.squad.repoUrl && (
						<a
							href={detail.squad.repoUrl}
							target="_blank"
							rel="noreferrer"
							className="text-[11px] font-mono text-[#E43A9C] hover:text-[#F041FF] flex items-center gap-1 mt-1 transition-colors"
						>
							<ExternalLink className="w-3 h-3" />
							{detail.squad.repoUrl.replace("https://github.com/", "")}
						</a>
					)}
				</div>
				<Chip variant={statusToVariant(detail.squad.status)}>{detail.squad.status}</Chip>
			</div>

			{/* Tabs */}
			<div className="flex gap-0 mb-5 border-b border-white/[0.06]">
				{(["agents", "instances", "schedules", "history"] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={`px-4 py-2 text-[11px] font-mono capitalize transition-colors border-b-2 -mb-px ${
							tab === t
								? "text-[#E43A9C] border-[#E43A9C]"
								: "text-zinc-600 hover:text-zinc-300 border-transparent"
						}`}
					>
						{t}
					</button>
				))}
			</div>

			{tab === "agents" && (
				<div className="space-y-2">
					{detail.members.map((agent) => (
						<button
							type="button"
							key={agent.id}
							onClick={() => navigate(`/squads/${name}/agents/${agent.roleName || agent.role}`)}
							className="w-full glass-card border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
						>
							<div
								className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
								style={{ border: `1px solid ${color}30`, background: `${color}12` }}
							>
								{roleIcon(agent.roleName || agent.role, color as string)}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm font-mono text-zinc-200">{agent.displayName}</span>
									<Chip variant={statusToVariant(agent.status)}>{agent.status}</Chip>
								</div>
								<p className="text-[11px] text-zinc-600 font-mono mt-0.5">{agent.role}</p>
								{agent.currentTask && (
									<p className="text-xs text-zinc-500 mt-1 truncate">{agent.currentTask}</p>
								)}
							</div>
						</button>
					))}
				</div>
			)}

			{tab === "instances" && (
				<div className="space-y-2">
					{detail.instances.length === 0 ? (
						<div className="text-center py-16 text-zinc-700 font-mono text-sm">
							No active instances
						</div>
					) : (
						detail.instances.map((inst) => (
							<div
								key={inst.id}
								className="glass-card border border-white/[0.07] rounded-2xl p-4 flex items-center gap-4"
							>
								<div className="flex-1 grid grid-cols-2 gap-2 text-[11px] font-mono">
									<div>
										<span className="text-zinc-700">ID</span>
										<p className="text-zinc-300 mt-0.5 truncate">{inst.id.slice(0, 8)}</p>
									</div>
									<div>
										<span className="text-zinc-700">Branch</span>
										<p className="text-zinc-300 mt-0.5 truncate">{inst.branch || "—"}</p>
									</div>
									<div>
										<span className="text-zinc-700">Status</span>
										<p className="text-zinc-300 mt-0.5">
											<Chip variant={statusToVariant(inst.status)}>{inst.status}</Chip>
										</p>
									</div>
									<div>
										<span className="text-zinc-700">Tasks</span>
										<p className="text-zinc-300 mt-0.5">
											{inst.tasksComplete}/{inst.taskCount}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										type="button"
										onClick={() => navigate(`/squads/${name}/instances/${inst.id}`)}
										title="View instance agents"
										className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
										style={{ color }}
									>
										<Activity className="w-4 h-4" />
									</button>
									<button
										type="button"
										onClick={async () => {
											try {
												await api.post(`/squads/${name}/instances/${inst.id}/cancel`);
												toast.success("Instance cancelled");
											} catch {
												toast.error("Failed to cancel instance");
											}
										}}
										title="Stop instance"
										className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
									>
										<Square className="w-4 h-4" />
									</button>
								</div>
							</div>
						))
					)}
				</div>
			)}

			{tab === "schedules" && (
				<div className="overflow-auto rounded-2xl border border-white/[0.07] glass-card">
					{schedules.length === 0 ? (
						<div className="text-center py-16 text-zinc-700 font-mono text-sm">
							No schedules for this squad
						</div>
					) : (
						<table className="w-full text-[11px] font-mono">
							<thead>
								<tr
									className="border-b border-white/[0.06]"
									style={{ background: "rgba(20,20,20,0.6)" }}
								>
									{["Schedule", "Next Run", "Status"].map((h) => (
										<th key={h} className="text-left px-4 py-2.5 text-zinc-600 font-medium">
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{schedules.map((s) => (
									<tr
										key={s.id}
										className={`border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors ${!s.enabled ? "opacity-50" : ""}`}
									>
										<td className="px-4 py-3">
											<div className="text-zinc-300">{s.name || s.prompt}</div>
											<div className="text-zinc-700 text-[10px] mt-0.5">{s.cron}</div>
										</td>
										<td className="px-4 py-3 text-zinc-600">
											<span className="flex items-center gap-1">
												<Clock className="w-3 h-3" />
												{!s.enabled ? "—" : s.nextRun ? formatDateTime(s.nextRun, timezone) : "—"}
											</span>
										</td>
										<td className="px-4 py-3">
											<Chip variant={!s.enabled ? "muted" : "success"}>
												{s.enabled ? "active" : "paused"}
											</Chip>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			)}

			{tab === "history" && (
				<div className="space-y-2">
					{historyItems.length === 0 ? (
						<div className="text-center py-16 text-zinc-700 font-mono text-sm">No history yet</div>
					) : (
						historyItems.map((activity) => (
							<button
								type="button"
								key={activity.id}
								onClick={() => drillIntoActivity(activity)}
								className="w-full glass-card border border-white/[0.07] rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
							>
								<div className="flex-shrink-0">
									{activity.status === "completed" ? (
										<CheckCircle className="w-4 h-4" style={{ color: "#34d399" }} />
									) : (
										<XCircle className="w-4 h-4" style={{ color: "#f87171" }} />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-[12px] text-zinc-300 font-mono truncate">{activity.title}</p>
									<div className="flex items-center gap-3 mt-0.5">
										<span className="text-[10px] text-zinc-700 font-mono">
											{formatDateTime(activity.completedAt || activity.createdAt, timezone)}
										</span>
										<span className="text-[10px] text-zinc-700 font-mono flex items-center gap-1">
											<Activity className="w-2.5 h-2.5" />
											{activity.duration || "—"}
										</span>
										<span className="text-[10px] text-zinc-700 font-mono flex items-center gap-1">
											<Bot className="w-2.5 h-2.5" />
											{activity.agentCount} agent{activity.agentCount !== 1 ? "s" : ""}
										</span>
									</div>
								</div>
								<Chip variant={activity.status === "completed" ? "success" : "error"}>
									{activity.status}
								</Chip>
							</button>
						))
					)}
					{historyItems.length < historyTotal && (
						<button
							type="button"
							onClick={() => {
								api
									.get<{ items: HistoryActivity[]; total: number }>(
										`/squads/${name}/history?offset=${historyItems.length}`,
									)
									.then((res) => {
										setHistoryItems((prev) => [...prev, ...res.items]);
									})
									.catch(() => {});
							}}
							className="w-full text-center py-3 text-[11px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
						>
							Load more
						</button>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Activity Detail View (Unified Timeline) ────────────────────────────────

function ActivityDetailView({
	activity,
	squadColor,
	squadName,
	onBack,
}: {
	activity: HistoryActivityDetail;
	squadColor: string;
	squadName: string;
	onBack: () => void;
}) {
	const timezone = useTimezone();
	const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());

	// Assign a deterministic color to each agent
	const agentColors = useMemo(() => {
		const map: Record<string, string> = {};
		for (const entry of activity.agentEntries) {
			map[entry.agentId] = agentColor(entry.agentName);
		}
		return map;
	}, [activity]);

	const kindMeta: Record<string, { label: string; icon: React.ElementType }> = {
		thought: { label: "Thinking", icon: MessageSquare },
		tool_call: { label: "Tool Call", icon: Terminal },
		tool_result: { label: "Tool Result", icon: Hash },
		message: { label: "Message", icon: Bot },
		decision: { label: "Decision", icon: Crown },
	};

	const defaultMeta = { label: "Message", icon: Bot };
	const getKindMeta = (kind: string): { label: string; icon: React.ElementType } =>
		kindMeta[kind] ?? defaultMeta;

	// Toggle agent filter
	const toggleAgent = (agentId: string) => {
		setSelectedAgents((prev) => {
			const next = new Set(prev);
			if (next.has(agentId)) {
				next.delete(agentId);
			} else {
				next.add(agentId);
			}
			return next;
		});
	};

	// Flatten all events into a unified timeline sorted by timestamp
	const timeline = useMemo(() => {
		const flat = activity.agentEntries.flatMap((entry) =>
			entry.events.map((ev) => ({ ev, entry })),
		);
		flat.sort((a, b) => a.ev.timestamp.localeCompare(b.ev.timestamp));
		// Apply agent filter
		if (selectedAgents.size > 0) {
			return flat.filter(({ entry }) => selectedAgents.has(entry.agentId));
		}
		return flat;
	}, [activity, selectedAgents]);

	return (
		<div className="flex-1 overflow-y-auto p-6" style={{ background: `${squadColor}06` }}>
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 font-mono mb-5 transition-colors cursor-pointer"
			>
				<ChevronLeft className="w-3.5 h-3.5" /> Back to {squadName}
			</button>

			{/* Header */}
			<div className="flex items-start justify-between mb-5">
				<div>
					<h2
						className="text-2xl tracking-wide"
						style={{ fontFamily: "'Bebas Neue', sans-serif", color: squadColor }}
					>
						{activity.title}
					</h2>
					<div className="flex items-center gap-3 mt-1">
						<span className="text-[11px] text-zinc-600 font-mono">
							{formatDateTime(activity.completedAt || activity.createdAt, timezone)}
						</span>
						<span className="text-[11px] text-zinc-700 font-mono flex items-center gap-1">
							<Clock className="w-3 h-3" />
							{activity.duration || "—"}
						</span>
					</div>
				</div>
				<Chip variant={activity.status === "completed" ? "success" : "error"}>
					{activity.status}
				</Chip>
			</div>

			{/* Agent legend — clickable to filter */}
			<div className="flex flex-wrap gap-2 mb-6">
				{activity.agentEntries.map((entry) => {
					const color = agentColors[entry.agentId];
					const isSelected = selectedAgents.has(entry.agentId);
					const isFiltering = selectedAgents.size > 0;
					const isActive = !isFiltering || isSelected;
					return (
						<button
							type="button"
							key={entry.agentId}
							onClick={() => toggleAgent(entry.agentId)}
							className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer"
							style={{
								borderColor: isActive ? `${color}30` : "rgba(255,255,255,0.05)",
								background: isActive ? `${color}10` : "transparent",
								opacity: isActive ? 1 : 0.4,
							}}
						>
							{roleIcon(entry.roleType || entry.role, color!)}
							<span
								className="text-[11px] font-mono"
								style={{ color: isActive ? color : "#71717a" }}
							>
								{entry.agentName}
							</span>
							<span className="text-[10px] font-mono text-zinc-500">— {entry.role}</span>
						</button>
					);
				})}
				{selectedAgents.size > 0 && (
					<button
						type="button"
						onClick={() => setSelectedAgents(new Set())}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
					>
						Show all
					</button>
				)}
			</div>

			{/* Unified timeline */}
			<div className="relative pl-10">
				<div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/[0.06]" />
				<div className="space-y-3">
					{timeline.map(({ ev, entry }) => {
						const color = agentColors[entry.agentId]!;
						const { label, icon: KindIcon } = getKindMeta(ev.kind);
						const isCode = ev.kind === "tool_call" || ev.kind === "tool_result";
						return (
							<div key={ev.id} className="relative">
								{/* Spine node — agent color */}
								<div
									className="absolute -left-10 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center"
									style={{
										background: `${color}15`,
										border: `1px solid ${color}35`,
									}}
								>
									<KindIcon className="w-3.5 h-3.5" style={{ color }} />
								</div>

								<div className="glass-card border border-white/[0.07] rounded-2xl px-4 py-3">
									<div className="flex items-center justify-between mb-1.5">
										<div className="flex items-center gap-2 flex-wrap">
											{/* Agent tag */}
											<div className="flex items-center gap-1">
												{roleIcon(entry.roleType || entry.role, color)}
												<span className="text-[10px] font-mono" style={{ color }}>
													{entry.agentName}
												</span>
											</div>
											<span className="text-zinc-700 text-[10px]">·</span>
											{/* Event kind */}
											<span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
												{label}
											</span>
											{ev.label && (
												<span className="text-[10px] font-mono text-zinc-600 border border-white/[0.08] rounded px-1.5 py-px bg-white/[0.03]">
													{ev.label}
												</span>
											)}
											{ev.status === "error" && <Chip variant="error">failed</Chip>}
											{ev.status === "ok" && ev.kind === "tool_result" && (
												<Chip variant="success">ok</Chip>
											)}
										</div>
										<span className="text-[10px] font-mono text-zinc-700 flex-shrink-0 ml-2">
											{formatTime(ev.timestamp, timezone)}
										</span>
									</div>
									{isCode ? (
										<pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed overflow-x-auto rounded-lg p-2 mt-1 bg-black/20">
											{ev.content}
										</pre>
									) : (
										<MarkdownRenderer
											content={ev.content}
											className="text-[12px] [&_pre]:text-[10px]"
										/>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ─── Instance Detail View ─────────────────────────────────────────────────────

type WorkEventKind = "thought" | "tool_call" | "tool_result" | "message" | "decision" | "meeting";

const KIND_META: Record<
	WorkEventKind,
	{ label: string; icon: React.ElementType; color: string; bg: string }
> = {
	thought: {
		label: "Thinking",
		icon: MessageSquare,
		color: "#a78bfa",
		bg: "rgba(167,139,250,0.1)",
	},
	tool_call: { label: "Tool Call", icon: Terminal, color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
	tool_result: {
		label: "Tool Result",
		icon: Hash,
		color: "#34d399",
		bg: "rgba(52,211,153,0.1)",
	},
	message: { label: "Message", icon: Bot, color: "#E43A9C", bg: "rgba(228,58,156,0.15)" },
	decision: { label: "Decision", icon: Crown, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
	meeting: { label: "Meeting", icon: Users, color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
};

function mapActivityTypeToKind(type: string): WorkEventKind {
	const t = type.toLowerCase();
	if (t.includes("meeting")) return "meeting";
	if (t.includes("tool_call") || t.includes("tool-call")) return "tool_call";
	if (t.includes("tool_result") || t.includes("tool-result")) return "tool_result";
	if (t.includes("thought") || t.includes("thinking") || t.includes("reason")) return "thought";
	if (t.includes("decision")) return "decision";
	return "message";
}

function InstanceDetailView({
	squadName,
	instanceId,
}: {
	squadName: string;
	instanceId: string;
}) {
	const [detail, setDetail] = useState<InstanceDetail | null>(null);
	const [liveEvents, setLiveEvents] = useState<AgentActivityEvent[]>([]);
	const [filteredAgent, setFilteredAgent] = useState<string | null>(null);
	const [instanceStatus, setInstanceStatus] = useState<string>("running");
	const [unseenCount, setUnseenCount] = useState(0);
	const navigate = useNavigate();
	const timezone = useTimezone();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const isNearBottomRef = useRef(true);

	// Track scroll position
	const handleScroll = useCallback(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const threshold = 100;
		isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
		if (isNearBottomRef.current) {
			setUnseenCount(0);
		}
	}, []);

	// Initial fetch
	useEffect(() => {
		api
			.get<InstanceDetail>(`/squads/${squadName}/instances/${instanceId}`)
			.then((res) => {
				setDetail(res);
				setInstanceStatus(res.instance.status);
			})
			.catch(() => {
				toast.error("Failed to load instance");
			});
	}, [squadName, instanceId]);

	// WebSocket live events
	useWebSocket({
		onEvent: (msg: WsMessage) => {
			if (!msg.event) return;
			const ev = msg.event;

			// Instance status updates
			if (
				(ev.type === "instance:completed" ||
					ev.type === "instance:failed" ||
					ev.type === "instance.completed" ||
					ev.type === "instance.failed") &&
				ev.instanceId === instanceId
			) {
				setInstanceStatus(
					ev.type === "instance:completed" || ev.type === "instance.completed"
						? "completed"
						: "failed",
				);
				return;
			}

			// Agent activity events
			if (
				(ev.type.startsWith("agent:") || ev.type.startsWith("agent.")) &&
				ev.instanceId === instanceId
			) {
				const data = ev.data as Record<string, unknown> | undefined;
				const toolName = (data?.tool as string) || null;
				const success = typeof data?.success === "boolean" ? data.success : null;

				let content = "";
				if (toolName && data?.arguments) {
					// Tool call: show arguments in a readable way
					const args = data.arguments;
					if (typeof args === "string") {
						content = args;
					} else if (typeof args === "object" && args !== null) {
						const argObj = args as Record<string, unknown>;
						// For bash/shell, show the command
						if (argObj.command) {
							content = String(argObj.command);
						} else {
							content = JSON.stringify(args, null, 2);
						}
					}
				} else if (data?.result) {
					content = String(data.result);
				} else if (data?.error) {
					content = String(data.error);
				} else {
					content = (data?.content as string) || "";
				}

				// Try to simplify JSON content
				try {
					const parsed = JSON.parse(content);
					if (typeof parsed === "object" && parsed !== null) {
						content =
							parsed.message ??
							parsed.content ??
							parsed.response ??
							parsed.decision ??
							JSON.stringify(parsed, null, 2);
					}
				} catch {
					// already a plain string
				}

				const newEvent: AgentActivityEvent = {
					id: ev.id,
					agent: (ev.agentRole as string) || (data?.agentRole as string) || "unknown",
					type: ev.type.replace(/^agent[:.]/, ""),
					content,
					toolName,
					success,
					model: (ev.model as string) || (data?.model as string) || null,
					tokensUsed: null,
					timestamp: ev.timestamp,
				};
				setLiveEvents((prev) => [...prev, newEvent]);

				// Auto-scroll or increment unseen
				if (isNearBottomRef.current) {
					setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
				} else {
					setUnseenCount((c) => c + 1);
				}
			}
		},
	});

	if (!detail) {
		return <div className="h-full flex items-center justify-center text-zinc-600">Loading...</div>;
	}

	const color = detail.squadColor || "#38bdf8";

	// Merge initial activity with live events
	const allEvents = [...detail.activity, ...liveEvents];

	// Dedupe by id
	const deduped = Array.from(new Map(allEvents.map((e) => [e.id, e])).values());

	// Sort chronologically
	deduped.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

	// Apply agent filter
	const timeline = filteredAgent ? deduped.filter((e) => e.agent === filteredAgent) : deduped;

	// Compute agent colors
	const agentNames = [...new Set(deduped.map((e) => e.agent))];
	const agentColors: Record<string, string> = {};
	for (const name of agentNames) {
		agentColors[name] = agentColor(name);
	}

	const isLive =
		instanceStatus === "running" ||
		instanceStatus === "working" ||
		instanceStatus === "meeting" ||
		instanceStatus === "planning";

	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className="flex-1 overflow-y-auto p-6"
			style={{ background: `${color}06` }}
		>
			<button
				type="button"
				onClick={() => navigate(`/squads/${squadName}`)}
				className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 font-mono mb-5 transition-colors"
			>
				<ChevronLeft className="w-3.5 h-3.5" /> Back to {squadName}
			</button>

			{/* Header */}
			<div className="flex items-start justify-between mb-5">
				<div>
					<h2
						className="text-2xl tracking-wide"
						style={{ fontFamily: "'Bebas Neue', sans-serif", color }}
					>
						Instance
					</h2>
					<p className="text-[11px] text-zinc-600 font-mono mt-0.5">
						{detail.instance.id.slice(0, 8)}
					</p>
					{detail.instance.branch && (
						<p className="text-[11px] text-zinc-700 font-mono mt-0.5">{detail.instance.branch}</p>
					)}
				</div>
				<Chip variant={statusToVariant(instanceStatus)}>{instanceStatus}</Chip>
			</div>

			{/* Agent legend/toolbar */}
			<div className="flex flex-wrap gap-2 mb-6">
				{detail.members.map((agent) => {
					const agentKey = agent.roleName || agent.role;
					const ac = agentColors[agentKey] || agentColor(agentKey);
					const isFiltered = filteredAgent === agentKey;
					return (
						<button
							key={agent.id}
							type="button"
							onClick={() => setFilteredAgent(isFiltered ? null : agentKey)}
							className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer"
							style={{
								borderColor: isFiltered ? ac : `${ac}30`,
								background: isFiltered ? `${ac}25` : `${ac}10`,
								opacity: filteredAgent && !isFiltered ? 0.5 : 1,
							}}
						>
							{roleIcon(agentKey, ac)}
							<span className="text-[11px] font-mono" style={{ color: ac }}>
								{agent.displayName}
							</span>
							<Chip variant={statusToVariant(agent.status)}>{agent.status}</Chip>
							{agent.status === "working" && (
								<button
									type="button"
									onClick={async (e) => {
										e.stopPropagation();
										try {
											await api.post(`/squads/${squadName}/instances/${instanceId}/cancel`);
											toast.success("Instance cancelled");
										} catch {
											toast.error("Failed to cancel instance");
										}
									}}
									title="Cancel instance"
									className="ml-1 p-1 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
								>
									<Square className="w-3 h-3" />
								</button>
							)}
						</button>
					);
				})}
				{filteredAgent && (
					<button
						type="button"
						onClick={() => setFilteredAgent(null)}
						className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
					>
						Show all
					</button>
				)}
			</div>

			{/* Unified timeline */}
			<div className="relative pl-10">
				<div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/[0.06]" />
				<div className="space-y-3">
					{timeline.length === 0 && (
						<div className="text-center py-12 text-zinc-700 font-mono text-sm">
							No activity recorded yet
						</div>
					)}
					{timeline.map((ev) => {
						const kind = mapActivityTypeToKind(ev.type);
						const meta = KIND_META[kind];
						const Icon = meta.icon;
						const ac = agentColors[ev.agent] || agentColor(ev.agent);
						const isCode = kind === "tool_call" || kind === "tool_result";
						const isError =
							ev.type.toLowerCase().includes("error") || ev.type.toLowerCase().includes("fail");
						return (
							<div key={ev.id} className="relative">
								{/* Spine node — agent color */}
								<div
									className="absolute -left-10 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center"
									style={{
										background: `${ac}15`,
										border: `1px solid ${ac}35`,
									}}
								>
									<Icon className="w-3.5 h-3.5" style={{ color: ac }} />
								</div>

								<div className="glass-card border border-white/[0.07] rounded-2xl px-4 py-3">
									<div className="flex items-center justify-between mb-1.5">
										<div className="flex items-center gap-2 flex-wrap">
											{/* Agent tag */}
											<div className="flex items-center gap-1">
												{roleIcon(ev.agent, ac)}
												<span className="text-[10px] font-mono" style={{ color: ac }}>
													{ev.agent}
												</span>
											</div>
											<span className="text-zinc-700 text-[10px]">·</span>
											{/* Event kind */}
											<span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
												{meta.label}
											</span>
											{/* Tool name label */}
											{ev.toolName && (
												<span className="text-[10px] font-mono text-sky-400 border border-sky-400/20 rounded px-1.5 py-px bg-sky-400/[0.06]">
													{ev.toolName}
												</span>
											)}
											{ev.model && (
												<span className="text-[10px] font-mono text-zinc-600 border border-white/[0.08] rounded px-1.5 py-px bg-white/[0.03]">
													{ev.model}
												</span>
											)}
											{/* Success/failure pill for tool results */}
											{ev.success === true && (
												<span className="text-[10px] font-mono text-emerald-400 border border-emerald-400/20 rounded px-1.5 py-px bg-emerald-400/[0.08]">
													success
												</span>
											)}
											{ev.success === false && (
												<span className="text-[10px] font-mono text-red-400 border border-red-400/20 rounded px-1.5 py-px bg-red-400/[0.08]">
													failed
												</span>
											)}
											{isError && ev.success === null && <Chip variant="error">failed</Chip>}
										</div>
										<span className="text-[10px] font-mono text-zinc-700 flex-shrink-0 ml-2">
											{formatTime(ev.timestamp, timezone)}
										</span>
									</div>
									{isCode ? (
										<pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed overflow-x-auto rounded-lg p-2 mt-1 bg-black/20">
											{ev.content}
										</pre>
									) : (
										<MarkdownRenderer
											content={ev.content}
											className="text-[12px] [&_pre]:text-[10px]"
										/>
									)}
								</div>
							</div>
						);
					})}

					{/* Live indicator */}
					{isLive && (
						<div className="relative">
							<div
								className="absolute -left-10 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center"
								style={{ background: `${color}15`, border: `1px solid ${color}40` }}
							>
								<Loader className="w-3.5 h-3.5 animate-spin" style={{ color }} />
							</div>
							<div
								className="glass-card border rounded-2xl px-4 py-3"
								style={{ borderColor: `${color}20` }}
							>
								<span className="text-[11px] font-mono" style={{ color }}>
									Working…
								</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Scroll anchor */}
			<div ref={bottomRef} />

			{/* New activity pill */}
			{unseenCount > 0 && (
				<button
					type="button"
					onClick={() => {
						bottomRef.current?.scrollIntoView({ behavior: "smooth" });
						setUnseenCount(0);
					}}
					className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/[0.1] bg-zinc-900/90 backdrop-blur-sm text-[11px] font-mono text-zinc-300 hover:text-white shadow-lg transition-all cursor-pointer z-50"
				>
					<ArrowDown className="w-3.5 h-3.5" />
					{unseenCount} new event{unseenCount !== 1 ? "s" : ""}
				</button>
			)}
		</div>
	);
}

// ─── Agent Detail View ───────────────────────────────────────────────────────

function AgentDetailView({ squadName, role }: { squadName: string; role: string }) {
	const navigate = useNavigate();
	const [member, setMember] = useState<{
		id: string;
		squadId: string;
		role: string;
		name: string;
		systemPrompt: string;
		model: string | null;
	} | null>(null);
	const [editing, setEditing] = useState(false);
	const [promptBuffer, setPromptBuffer] = useState("");
	const [modelBuffer, setModelBuffer] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		api
			.get<{
				squad: SharedSquad;
				members: Array<{
					id: string;
					squadId: string;
					role: string;
					name: string;
					systemPrompt: string;
					model: string | null;
				}>;
			}>(`/squads/${squadName}`)
			.then((res) => {
				const m = res.members.find((m) => m.role === role);
				if (m) setMember(m);
			})
			.catch(() => {});
	}, [squadName, role]);

	const handleSave = async () => {
		if (!member) return;
		setSaving(true);
		try {
			const updated = await api.put<typeof member>(
				`/squads/${member.squadId}/members/${member.id}`,
				{
					systemPrompt: promptBuffer,
					model: modelBuffer,
				},
			);
			setMember(updated);
			setEditing(false);
			toast.success("Agent updated");
		} catch {
			toast.error("Failed to save agent");
		} finally {
			setSaving(false);
		}
	};

	if (!member) {
		return <div className="h-full flex items-center justify-center text-zinc-600">Loading...</div>;
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<button
				type="button"
				onClick={() => navigate(`/squads/${squadName}`)}
				className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 font-mono mb-5 transition-colors cursor-pointer"
			>
				<ChevronLeft className="w-3.5 h-3.5" /> Back to {squadName}
			</button>

			{/* Agent header */}
			<div className="glass-card border border-white/[0.07] rounded-2xl p-5 mb-5">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.1] bg-white/[0.04]">
						{roleIcon(member.role, "#38bdf8")}
					</div>
					<div className="flex-1">
						<h2
							className="text-xl tracking-wide text-zinc-100"
							style={{ fontFamily: "'Bebas Neue', sans-serif" }}
						>
							{member.name}
						</h2>
						<span className="text-[11px] font-mono text-zinc-500">{member.role}</span>
					</div>
				</div>
				{/* Model display (read mode) */}
				{!editing && (
					<div className="mt-3 flex items-center gap-2">
						<span className="text-[10px] font-mono text-zinc-600">MODEL:</span>
						<span className="text-[11px] font-mono text-zinc-400">{member.model || "default"}</span>
					</div>
				)}
			</div>

			{/* System Prompt */}
			<div className="glass-card border border-white/[0.07] rounded-2xl p-5">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-mono text-zinc-300">System Prompt</h3>
					{!editing ? (
						<button
							type="button"
							onClick={() => {
								setPromptBuffer(member.systemPrompt);
								setModelBuffer(member.model || "");
								setEditing(true);
							}}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-zinc-400 hover:text-zinc-200 border border-white/[0.1] hover:border-white/[0.2] transition-colors cursor-pointer"
						>
							<Pencil className="w-3 h-3" /> Edit
						</button>
					) : (
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-zinc-500 hover:text-zinc-300 border border-white/[0.1] transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-colors cursor-pointer disabled:opacity-50"
							>
								<Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
							</button>
						</div>
					)}
				</div>

				{editing ? (
					<>
						{/* Model field */}
						<div className="mb-4">
							<label
								htmlFor="model-override-input"
								className="block text-[10px] font-mono text-zinc-600 mb-1.5"
							>
								MODEL OVERRIDE (leave empty for default)
							</label>
							<input
								id="model-override-input"
								type="text"
								value={modelBuffer}
								onChange={(e) => setModelBuffer(e.target.value)}
								placeholder="e.g. claude-sonnet-4.5"
								className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] font-mono text-zinc-300 focus:outline-none focus:border-white/[0.2] placeholder:text-zinc-700"
							/>
						</div>
						{/* System prompt editor */}
						<textarea
							value={promptBuffer}
							onChange={(e) => setPromptBuffer(e.target.value)}
							className="w-full h-[500px] bg-black/30 border border-white/[0.08] rounded-xl p-4 text-[12px] font-mono text-zinc-300 resize-y focus:outline-none focus:border-white/[0.2] leading-relaxed"
							spellCheck={false}
						/>
					</>
				) : member.systemPrompt ? (
					<MarkdownRenderer
						content={member.systemPrompt}
						className="text-[12px] [&_pre]:text-[11px]"
					/>
				) : (
					<p className="text-zinc-700 text-[12px] font-mono py-8 text-center">
						No system prompt configured for this agent
					</p>
				)}
			</div>
		</div>
	);
}
