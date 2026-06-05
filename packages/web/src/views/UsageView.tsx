import { useTimezone } from "@/hooks/use-config";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/timezone";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface UsageEntry {
	model: string;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number | null;
	timestamp: string;
	squadId: string | null;
	squadName: string | null;
	agentRole: string | null;
}

interface UsageResponse {
	records: UsageEntry[];
	totals: {
		totalInputTokens: number;
		totalOutputTokens: number;
		totalCostUsd: number;
		callCount: number;
	};
}

type UsageTab = "summary" | "by squad" | "by agent" | "io" | "timeline";

const TOOLTIP_STYLE = {
	backgroundColor: "#1e1e1e",
	border: "1px solid rgba(255,255,255,0.08)",
	borderRadius: "12px",
	color: "#e4e0dc",
	fontSize: "11px",
	fontFamily: "JetBrains Mono, monospace",
};

function fmt(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(Math.round(n));
}

function fmtCost(n: number): string {
	return `$${n.toFixed(2)}`;
}

function StatCard({
	label,
	value,
	sub,
	accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
	return (
		<div className="glass-card border border-white/[0.07] rounded-2xl px-5 py-4">
			<p className="text-[11px] font-mono text-zinc-600 mb-1">{label}</p>
			<p className={`text-xl font-mono font-medium ${accent ? "text-[#E43A9C]" : "text-zinc-100"}`}>
				{value}
			</p>
			{sub && <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{sub}</p>}
		</div>
	);
}

const TAB_LABELS: Record<string, string> = {
	summary: "Summary",
	"by squad": "By Squad",
	"by agent": "By Agent",
	io: "IO",
	timeline: "Timeline",
};

function TabBar({
	tabs,
	active,
	onChange,
}: { tabs: string[]; active: string; onChange: (t: string) => void }) {
	return (
		<div className="flex gap-0 border-b border-white/[0.06] mb-5">
			{tabs.map((t) => (
				<button
					key={t}
					type="button"
					onClick={() => onChange(t)}
					className={`px-4 py-2 text-[11px] font-mono transition-colors border-b-2 -mb-px cursor-pointer ${
						active === t
							? "text-[#E43A9C] border-[#E43A9C]"
							: "text-zinc-600 hover:text-zinc-300 border-transparent"
					}`}
				>
					{TAB_LABELS[t] ?? t}
				</button>
			))}
		</div>
	);
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({
	records,
	totals,
}: { records: UsageEntry[]; totals: UsageResponse["totals"] }) {
	const totalTokens = totals.totalInputTokens + totals.totalOutputTokens;

	// Aggregate by entity (squad or IO)
	const byEntity = new Map<
		string,
		{ name: string; inputTokens: number; outputTokens: number; calls: number; cost: number }
	>();
	for (const r of records) {
		const key = r.squadId ?? "__io__";
		const name =
			r.squadName ?? (r.squadId ? `${r.squadId.slice(0, 8)} (deleted)` : "IO Orchestrator");
		const existing = byEntity.get(key) ?? {
			name,
			inputTokens: 0,
			outputTokens: 0,
			calls: 0,
			cost: 0,
		};
		existing.inputTokens += r.inputTokens;
		existing.outputTokens += r.outputTokens;
		existing.calls += 1;
		existing.cost += r.estimatedCostUsd ?? 0;
		byEntity.set(key, existing);
	}
	const entities = Array.from(byEntity.values()).sort((a, b) => b.cost - a.cost);
	const barData = entities.map((e) => ({
		name: e.name.length > 12 ? `${e.name.slice(0, 12)}…` : e.name,
		cost: Number.parseFloat(e.cost.toFixed(2)),
		tokens: Math.round((e.inputTokens + e.outputTokens) / 1000),
	}));

	return (
		<div className="space-y-5">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<StatCard
					label="Total Tokens"
					value={fmt(totalTokens)}
					sub={`${fmt(totals.totalInputTokens)} in · ${fmt(totals.totalOutputTokens)} out`}
				/>
				<StatCard label="Total Cost" value={fmtCost(totals.totalCostUsd)} accent />
				<StatCard label="API Calls" value={fmt(totals.callCount)} sub="across all entities" />
				<StatCard
					label="Avg Cost / Call"
					value={totals.callCount > 0 ? fmtCost(totals.totalCostUsd / totals.callCount) : "$0.00"}
					sub={`over ${totals.callCount} calls`}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				<div className="glass-card border border-white/[0.07] rounded-2xl p-4">
					<p className="text-[11px] font-mono text-zinc-500 mb-3">Cost by entity</p>
					{barData.length > 0 ? (
						<ResponsiveContainer width="100%" height={180}>
							<BarChart data={barData} barCategoryGap="35%">
								<CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
								<XAxis
									dataKey="name"
									tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
									axisLine={false}
									tickLine={false}
									tickFormatter={(v) => `$${v}`}
									width={40}
								/>
								<Tooltip
									contentStyle={TOOLTIP_STYLE}
									cursor={{ fill: "rgba(255,255,255,0.03)" }}
									formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]}
								/>
								<Bar dataKey="cost" fill="url(#costGrad)" radius={[6, 6, 0, 0]} />
								<defs>
									<linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="#E43A9C" />
										<stop offset="100%" stopColor="#D83333" stopOpacity={0.7} />
									</linearGradient>
								</defs>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="h-[180px] flex items-center justify-center text-zinc-700 text-[11px] font-mono">
							No data
						</div>
					)}
				</div>

				<div className="glass-card border border-white/[0.07] rounded-2xl p-4">
					<p className="text-[11px] font-mono text-zinc-500 mb-3">Tokens by entity (k)</p>
					{barData.length > 0 ? (
						<ResponsiveContainer width="100%" height={180}>
							<BarChart data={barData} barCategoryGap="35%">
								<CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
								<XAxis
									dataKey="name"
									tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
									axisLine={false}
									tickLine={false}
									tickFormatter={(v) => `${v}k`}
									width={40}
								/>
								<Tooltip
									contentStyle={TOOLTIP_STYLE}
									cursor={{ fill: "rgba(255,255,255,0.03)" }}
									formatter={(v: number) => [`${v}k`, "Tokens"]}
								/>
								<Bar dataKey="tokens" fill="url(#tokenGrad)" radius={[6, 6, 0, 0]} />
								<defs>
									<linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="#818cf8" />
										<stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
									</linearGradient>
								</defs>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="h-[180px] flex items-center justify-center text-zinc-700 text-[11px] font-mono">
							No data
						</div>
					)}
				</div>
			</div>

			{/* Entity table */}
			<div className="overflow-auto rounded-2xl border border-white/[0.07] glass-card">
				<table className="w-full text-[11px] font-mono">
					<thead>
						<tr className="border-b border-white/[0.06] bg-[#1a1a1a]">
							{["Entity", "Input", "Output", "Calls", "Cost"].map((h) => (
								<th
									key={h}
									className={`text-left px-4 py-2.5 text-zinc-600 font-medium ${h === "Cost" ? "text-right" : ""}`}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{entities.map((e) => (
							<tr
								key={e.name}
								className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors"
							>
								<td className="px-4 py-3 text-zinc-300">{e.name}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(e.inputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(e.outputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{e.calls}</td>
								<td className="px-4 py-3 text-right text-[#E43A9C]">{fmtCost(e.cost)}</td>
							</tr>
						))}
						<tr className="bg-[#1a1a1a]">
							<td className="px-4 py-3 text-zinc-200 font-medium">Total</td>
							<td className="px-4 py-3 text-zinc-300">{fmt(totals.totalInputTokens)}</td>
							<td className="px-4 py-3 text-zinc-300">{fmt(totals.totalOutputTokens)}</td>
							<td className="px-4 py-3 text-zinc-300">{totals.callCount}</td>
							<td className="px-4 py-3 text-right text-[#E43A9C] font-medium">
								{fmtCost(totals.totalCostUsd)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── By Squad Tab ─────────────────────────────────────────────────────────────

function BySquadTab({ records }: { records: UsageEntry[] }) {
	const [expanded, setExpanded] = useState<string[]>([]);
	const [sortKey, setSortKey] = useState<
		"name" | "inputTokens" | "outputTokens" | "calls" | "cost"
	>("cost");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

	function toggleSort(key: typeof sortKey) {
		if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		else {
			setSortKey(key);
			setSortDir("desc");
		}
	}

	const squads = useMemo(() => {
		const map = new Map<
			string,
			{
				id: string;
				name: string;
				agents: Map<
					string,
					{
						role: string;
						model: string;
						inputTokens: number;
						outputTokens: number;
						calls: number;
						cost: number;
					}
				>;
				inputTokens: number;
				outputTokens: number;
				calls: number;
				cost: number;
			}
		>();
		for (const r of records) {
			if (!r.squadId) continue;
			const existing = map.get(r.squadId) ?? {
				id: r.squadId,
				name: r.squadName ?? `${r.squadId.slice(0, 8)} (deleted)`,
				agents: new Map(),
				inputTokens: 0,
				outputTokens: 0,
				calls: 0,
				cost: 0,
			};
			existing.inputTokens += r.inputTokens;
			existing.outputTokens += r.outputTokens;
			existing.calls += 1;
			existing.cost += r.estimatedCostUsd ?? 0;

			const agentKey = `${r.agentRole ?? "unknown"}:${r.model}`;
			const agent = existing.agents.get(agentKey) ?? {
				role: r.agentRole ?? "unknown",
				model: r.model,
				inputTokens: 0,
				outputTokens: 0,
				calls: 0,
				cost: 0,
			};
			agent.inputTokens += r.inputTokens;
			agent.outputTokens += r.outputTokens;
			agent.calls += 1;
			agent.cost += r.estimatedCostUsd ?? 0;
			existing.agents.set(agentKey, agent);
			map.set(r.squadId, existing);
		}
		const arr = Array.from(map.values());
		return [...arr].sort((a, b) => {
			const va = a[sortKey] as number | string;
			const vb = b[sortKey] as number | string;
			const cmp =
				typeof va === "string"
					? (va as string).localeCompare(vb as string)
					: (va as number) - (vb as number);
			return sortDir === "desc" ? -cmp : cmp;
		});
	}, [records, sortKey, sortDir]);

	const toggle = (id: string) =>
		setExpanded((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

	const sortCols: { key: typeof sortKey; label: string }[] = [
		{ key: "name", label: "Squad" },
		{ key: "inputTokens", label: "In" },
		{ key: "outputTokens", label: "Out" },
		{ key: "calls", label: "Calls" },
		{ key: "cost", label: "Cost" },
	];

	if (squads.length === 0) {
		return (
			<div className="text-center py-12 text-zinc-700 text-[11px] font-mono">
				No squad usage data
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Sort bar */}
			<div className="flex items-center gap-1 px-1 mb-1">
				<span className="text-[10px] font-mono text-zinc-700 mr-1">sort by</span>
				{sortCols.map((c) => (
					<button
						key={c.key}
						type="button"
						onClick={() => toggleSort(c.key)}
						className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-colors ${sortKey === c.key ? "text-[#E43A9C]" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"}`}
						style={sortKey === c.key ? { background: "rgba(228,58,156,0.1)" } : undefined}
					>
						{c.label}
						{sortKey === c.key && (
							<span className="text-[9px]">{sortDir === "desc" ? "↓" : "↑"}</span>
						)}
					</button>
				))}
			</div>

			{squads.map((sq) => {
				const open = expanded.includes(sq.id);
				const agents = Array.from(sq.agents.values());
				return (
					<div
						key={sq.id}
						className="glass-card border border-white/[0.07] rounded-2xl overflow-hidden"
					>
						<button
							type="button"
							onClick={() => toggle(sq.id)}
							className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
						>
							<div className={`transition-transform ${open ? "rotate-90" : ""}`}>
								<ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
							</div>
							<span className="text-sm font-mono text-zinc-100 flex-1">{sq.name}</span>
							<div className="flex items-center gap-6 text-[11px] font-mono">
								<span className="text-zinc-500 hidden sm:block">
									<span className="text-zinc-700 mr-1">in</span>
									{fmt(sq.inputTokens)}
								</span>
								<span className="text-zinc-500 hidden sm:block">
									<span className="text-zinc-700 mr-1">out</span>
									{fmt(sq.outputTokens)}
								</span>
								<span className="text-zinc-500">
									<span className="text-zinc-700 mr-1">calls</span>
									{sq.calls}
								</span>
								<span className="text-[#E43A9C] font-medium w-16 text-right">
									{fmtCost(sq.cost)}
								</span>
							</div>
						</button>

						{open && (
							<div className="border-t border-white/[0.05]">
								<table className="w-full text-[11px] font-mono">
									<thead>
										<tr className="bg-[#191919]">
											{["Agent", "Model", "Input", "Output", "Calls", "Cost"].map((h) => (
												<th
													key={h}
													className={`text-left px-4 py-2 text-zinc-700 font-medium ${h === "Cost" ? "text-right" : ""}`}
												>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{agents.map((a) => (
											<tr
												key={a.role}
												className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors"
											>
												<td className="px-4 py-2.5 text-zinc-300">{a.role}</td>
												<td className="px-4 py-2.5 text-zinc-600">{a.model}</td>
												<td className="px-4 py-2.5 text-zinc-500">{fmt(a.inputTokens)}</td>
												<td className="px-4 py-2.5 text-zinc-500">{fmt(a.outputTokens)}</td>
												<td className="px-4 py-2.5 text-zinc-500">{a.calls}</td>
												<td className="px-4 py-2.5 text-right text-[#E43A9C]">{fmtCost(a.cost)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ─── By Agent Tab ─────────────────────────────────────────────────────────────

function ByAgentTab({ records }: { records: UsageEntry[] }) {
	const agents = useMemo(() => {
		const map = new Map<
			string,
			{
				name: string;
				squad: string;
				model: string;
				inputTokens: number;
				outputTokens: number;
				calls: number;
				cost: number;
			}
		>();
		for (const r of records) {
			const key = `${r.squadId ?? "io"}:${r.agentRole ?? "orchestrator"}:${r.model}`;
			const existing = map.get(key) ?? {
				name: r.agentRole ?? "orchestrator",
				squad: r.squadName ?? (r.squadId ? r.squadId.slice(0, 8) : "IO"),
				model: r.model,
				inputTokens: 0,
				outputTokens: 0,
				calls: 0,
				cost: 0,
			};
			existing.inputTokens += r.inputTokens;
			existing.outputTokens += r.outputTokens;
			existing.calls += 1;
			existing.cost += r.estimatedCostUsd ?? 0;
			map.set(key, existing);
		}
		return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
	}, [records]);

	const totalCost = agents.reduce((s, a) => s + a.cost, 0);

	return (
		<div className="overflow-auto rounded-2xl border border-white/[0.07] glass-card">
			<table className="w-full text-[11px] font-mono">
				<thead>
					<tr className="border-b border-white/[0.06] bg-[#1a1a1a]">
						{["Agent", "Squad", "Model", "Input", "Output", "Calls", "Cost", "% of total"].map(
							(h) => (
								<th
									key={h}
									className={`text-left px-4 py-2.5 text-zinc-600 font-medium ${h === "Cost" ? "text-right" : ""}`}
								>
									{h}
								</th>
							),
						)}
					</tr>
				</thead>
				<tbody>
					{agents.map((a) => (
						<tr
							key={`${a.squad}:${a.name}`}
							className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors"
						>
							<td className="px-4 py-3 text-zinc-300">{a.name}</td>
							<td className="px-4 py-3 text-zinc-600">{a.squad}</td>
							<td className="px-4 py-3 text-zinc-600">{a.model}</td>
							<td className="px-4 py-3 text-zinc-500">{fmt(a.inputTokens)}</td>
							<td className="px-4 py-3 text-zinc-500">{fmt(a.outputTokens)}</td>
							<td className="px-4 py-3 text-zinc-500">{a.calls}</td>
							<td className="px-4 py-3 text-right text-[#E43A9C]">{fmtCost(a.cost)}</td>
							<td className="px-4 py-3">
								<div className="flex items-center gap-2">
									<div className="w-16 h-1.5 rounded-full bg-[#252525] overflow-hidden">
										<div
											className="h-full bg-[#E43A9C] rounded-full"
											style={{ width: `${totalCost > 0 ? (a.cost / totalCost) * 100 : 0}%` }}
										/>
									</div>
									<span className="text-zinc-600 text-[10px]">
										{totalCost > 0 ? `${((a.cost / totalCost) * 100).toFixed(1)}%` : "0%"}
									</span>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ─── IO Tab ───────────────────────────────────────────────────────────────────

function IOTab({ records }: { records: UsageEntry[] }) {
	const ioRecords = useMemo(() => records.filter((r) => !r.squadId), [records]);

	const byRole = useMemo(() => {
		const map = new Map<
			string,
			{
				name: string;
				model: string;
				inputTokens: number;
				outputTokens: number;
				calls: number;
				cost: number;
			}
		>();
		for (const r of ioRecords) {
			const key = `${r.agentRole ?? "orchestrator"}:${r.model}`;
			const existing = map.get(key) ?? {
				name: r.agentRole ?? "orchestrator",
				model: r.model,
				inputTokens: 0,
				outputTokens: 0,
				calls: 0,
				cost: 0,
			};
			existing.inputTokens += r.inputTokens;
			existing.outputTokens += r.outputTokens;
			existing.calls += 1;
			existing.cost += r.estimatedCostUsd ?? 0;
			map.set(key, existing);
		}
		return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
	}, [ioRecords]);

	const totalInput = ioRecords.reduce((s, r) => s + r.inputTokens, 0);
	const totalOutput = ioRecords.reduce((s, r) => s + r.outputTokens, 0);
	const totalCost = ioRecords.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);

	return (
		<div className="space-y-5">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<StatCard
					label="IO Tokens"
					value={fmt(totalInput + totalOutput)}
					sub={`${fmt(totalInput)} in · ${fmt(totalOutput)} out`}
				/>
				<StatCard label="IO Cost" value={fmtCost(totalCost)} accent />
				<StatCard label="IO Calls" value={fmt(ioRecords.length)} />
				<StatCard label="IO Roles" value={String(byRole.length)} />
			</div>

			<div className="overflow-auto rounded-2xl border border-white/[0.07] glass-card">
				<table className="w-full text-[11px] font-mono">
					<thead>
						<tr className="border-b border-white/[0.06] bg-[#1a1a1a]">
							{["Role", "Model", "Input", "Output", "Calls", "Cost"].map((h) => (
								<th
									key={h}
									className={`text-left px-4 py-2.5 text-zinc-600 font-medium ${h === "Cost" ? "text-right" : ""}`}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{byRole.map((r) => (
							<tr
								key={r.name}
								className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors"
							>
								<td className="px-4 py-3 text-zinc-300">{r.name}</td>
								<td className="px-4 py-3 text-zinc-600">{r.model}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(r.inputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(r.outputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{r.calls}</td>
								<td className="px-4 py-3 text-right text-[#E43A9C]">{fmtCost(r.cost)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ records }: { records: UsageEntry[] }) {
	const timezone = useTimezone();
	const dailyData = useMemo(() => {
		const byDay = new Map<
			string,
			{ date: string; inputTokens: number; outputTokens: number; cost: number; calls: number }
		>();
		for (const r of records) {
			const date = r.timestamp.slice(0, 10);
			const existing = byDay.get(date) ?? {
				date,
				inputTokens: 0,
				outputTokens: 0,
				cost: 0,
				calls: 0,
			};
			existing.inputTokens += r.inputTokens;
			existing.outputTokens += r.outputTokens;
			existing.cost += r.estimatedCostUsd ?? 0;
			existing.calls += 1;
			byDay.set(date, existing);
		}
		return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
	}, [records]);

	const chartData = dailyData.map((d) => ({
		...d,
		label: formatDate(d.date, timezone),
		tokens: d.inputTokens + d.outputTokens,
	}));

	return (
		<div className="space-y-5">
			<div className="glass-card border border-white/[0.07] rounded-2xl p-5">
				<p className="text-[11px] font-mono text-zinc-500 mb-3">Tokens per day</p>
				{chartData.length > 0 ? (
					<ResponsiveContainer width="100%" height={220}>
						<LineChart data={chartData}>
							<CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
							<XAxis
								dataKey="label"
								tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
								axisLine={false}
								tickLine={false}
								tickFormatter={fmt}
								width={44}
							/>
							<Tooltip
								contentStyle={TOOLTIP_STYLE}
								cursor={{ fill: "rgba(255,255,255,0.03)" }}
								formatter={(v: number) => [fmt(v), "Tokens"]}
							/>
							<Line type="monotone" dataKey="tokens" stroke="#E43A9C" strokeWidth={2} dot={false} />
						</LineChart>
					</ResponsiveContainer>
				) : (
					<div className="h-[220px] flex items-center justify-center text-zinc-700 text-[11px] font-mono">
						No data
					</div>
				)}
			</div>

			<div className="glass-card border border-white/[0.07] rounded-2xl p-5">
				<p className="text-[11px] font-mono text-zinc-500 mb-3">Cost per day</p>
				{chartData.length > 0 ? (
					<ResponsiveContainer width="100%" height={180}>
						<BarChart data={chartData} barCategoryGap="20%">
							<CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
							<XAxis
								dataKey="label"
								tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
								axisLine={false}
								tickLine={false}
								tickFormatter={(v) => `$${v.toFixed(2)}`}
								width={44}
							/>
							<Tooltip
								contentStyle={TOOLTIP_STYLE}
								cursor={{ fill: "rgba(255,255,255,0.03)" }}
								formatter={(v: number) => [fmtCost(v), "Cost"]}
							/>
							<Bar dataKey="cost" fill="url(#costGradTl)" radius={[4, 4, 0, 0]} />
							<defs>
								<linearGradient id="costGradTl" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#E43A9C" />
									<stop offset="100%" stopColor="#D83333" stopOpacity={0.7} />
								</linearGradient>
							</defs>
						</BarChart>
					</ResponsiveContainer>
				) : (
					<div className="h-[180px] flex items-center justify-center text-zinc-700 text-[11px] font-mono">
						No data
					</div>
				)}
			</div>

			{/* Daily breakdown table */}
			<div className="overflow-auto rounded-2xl border border-white/[0.07] glass-card">
				<table className="w-full text-[11px] font-mono">
					<thead>
						<tr className="border-b border-white/[0.06] bg-[#1a1a1a]">
							{["Date", "Input", "Output", "Calls", "Cost"].map((h) => (
								<th
									key={h}
									className={`text-left px-4 py-2.5 text-zinc-600 font-medium ${h === "Cost" ? "text-right" : ""}`}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{dailyData.map((d) => (
							<tr
								key={d.date}
								className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors"
							>
								<td className="px-4 py-3 text-zinc-300">{d.date}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(d.inputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{fmt(d.outputTokens)}</td>
								<td className="px-4 py-3 text-zinc-500">{d.calls}</td>
								<td className="px-4 py-3 text-right text-[#E43A9C]">{fmtCost(d.cost)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function UsageView() {
	const [tab, setTab] = useState<UsageTab>("summary");
	const [data, setData] = useState<UsageResponse | null>(null);
	const [range, setRange] = useState("14d");

	const tabs: UsageTab[] = ["summary", "by squad", "by agent", "io", "timeline"];

	useEffect(() => {
		const since = new Date();
		if (range === "7d") since.setDate(since.getDate() - 7);
		else if (range === "14d") since.setDate(since.getDate() - 14);
		else if (range === "30d") since.setDate(since.getDate() - 30);
		else since.setDate(since.getDate() - 1);

		api
			.get<UsageResponse>(`/usage?since=${since.toISOString()}`)
			.then(setData)
			.catch(() => {});
	}, [range]);

	if (!data) {
		return (
			<div className="h-full flex items-center justify-center text-zinc-600 font-mono text-[11px]">
				Loading...
			</div>
		);
	}

	const rangeLabel = range === "1d" ? "Today" : `Last ${range}`;

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h2
						className="text-2xl tracking-wide text-zinc-100"
						style={{ fontFamily: "'Bebas Neue', sans-serif" }}
					>
						Usage
					</h2>
					<p className="text-[11px] text-zinc-600 font-mono mt-0.5">{rangeLabel}</p>
				</div>
				<div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07]">
					{["1d", "7d", "14d", "30d"].map((r) => (
						<button
							key={r}
							type="button"
							onClick={() => setRange(r)}
							className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
								range === r ? "text-[#E43A9C]" : "text-zinc-600 hover:text-zinc-400"
							}`}
							style={range === r ? { background: "rgba(228,58,156,0.12)" } : undefined}
						>
							{r}
						</button>
					))}
				</div>
			</div>

			<TabBar tabs={tabs} active={tab} onChange={(t) => setTab(t as UsageTab)} />

			{tab === "summary" && <SummaryTab records={data.records} totals={data.totals} />}
			{tab === "by squad" && <BySquadTab records={data.records} />}
			{tab === "by agent" && <ByAgentTab records={data.records} />}
			{tab === "io" && <IOTab records={data.records} />}
			{tab === "timeline" && <TimelineTab records={data.records} />}
		</div>
	);
}
