import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
	Area,
	AreaChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

interface UsageEntry {
	id: number;
	squadId: string | null;
	agentRole: string | null;
	model: string;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number | null;
	timestamp: string;
}

interface UsageResponse {
	entries: UsageEntry[];
	totals: {
		inputTokens: number;
		outputTokens: number;
		estimatedCost: number;
		callCount: number;
	};
}

const CHART_COLORS = ['#E43A9C', '#D83333', '#F041FF', '#38bdf8', '#a78bfa', '#34d399', '#f59e0b'];

export function UsageView() {
	const [data, setData] = useState<UsageResponse | null>(null);
	const [range, setRange] = useState('7d');

	useEffect(() => {
		const since = new Date();
		if (range === '7d') since.setDate(since.getDate() - 7);
		else if (range === '30d') since.setDate(since.getDate() - 30);
		else since.setDate(since.getDate() - 1);

		api
			.get<UsageResponse>(`/usage?since=${since.toISOString()}`)
			.then(setData)
			.catch(() => {});
	}, [range]);

	if (!data) {
		return (
			<div className="h-full flex items-center justify-center text-[var(--color-muted-foreground)]">
				Loading...
			</div>
		);
	}

	// Aggregate by day for time chart
	const byDay = new Map<string, { date: string; tokens: number; cost: number }>();
	for (const entry of data.entries) {
		const date = entry.timestamp.slice(0, 10);
		const existing = byDay.get(date) ?? { date, tokens: 0, cost: 0 };
		existing.tokens += entry.inputTokens + entry.outputTokens;
		existing.cost += entry.estimatedCostUsd ?? 0;
		byDay.set(date, existing);
	}
	const dailyData = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

	// Aggregate by model for pie chart
	const byModel = new Map<string, number>();
	for (const entry of data.entries) {
		byModel.set(
			entry.model,
			(byModel.get(entry.model) ?? 0) + entry.inputTokens + entry.outputTokens,
		);
	}
	const modelData = Array.from(byModel.entries()).map(([name, value]) => ({ name, value }));

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold gradient-text">Usage</h1>
					<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
						Token usage and cost tracking
					</p>
				</div>
				<div className="flex gap-1 p-1 rounded-lg bg-white/3">
					{['1d', '7d', '30d'].map((r) => (
						<button
							key={r}
							type="button"
							onClick={() => setRange(r)}
							className={`px-3 py-1.5 rounded-md text-xs font-medium ${
								range === r
									? 'bg-white/10 text-[var(--color-foreground)]'
									: 'text-[var(--color-muted-foreground)]'
							}`}
						>
							{r}
						</button>
					))}
				</div>
			</header>

			{/* Summary cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
				<SummaryCard
					label="Total Tokens"
					value={formatNumber(data.totals.inputTokens + data.totals.outputTokens)}
				/>
				<SummaryCard label="Input Tokens" value={formatNumber(data.totals.inputTokens)} />
				<SummaryCard label="Output Tokens" value={formatNumber(data.totals.outputTokens)} />
				<SummaryCard label="Est. Cost" value={`$${data.totals.estimatedCost.toFixed(4)}`} />
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Daily usage chart */}
				<div className="lg:col-span-2 glass-card p-4">
					<h3 className="text-sm font-semibold mb-4">Tokens Over Time</h3>
					{dailyData.length > 0 ? (
						<ResponsiveContainer width="100%" height={250}>
							<AreaChart data={dailyData}>
								<defs>
									<linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#E43A9C" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#E43A9C" stopOpacity={0} />
									</linearGradient>
								</defs>
								<XAxis
									dataKey="date"
									tick={{ fontSize: 11, fill: '#9ca3af' }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: '#9ca3af' }}
									axisLine={false}
									tickLine={false}
									tickFormatter={formatNumber}
								/>
								<Tooltip
									contentStyle={{
										background: '#222',
										border: '1px solid #333',
										borderRadius: '8px',
										fontSize: '12px',
									}}
									labelStyle={{ color: '#9ca3af' }}
								/>
								<Area
									type="monotone"
									dataKey="tokens"
									stroke="#E43A9C"
									fill="url(#colorTokens)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ResponsiveContainer>
					) : (
						<div className="h-[250px] flex items-center justify-center text-[var(--color-muted-foreground)]">
							No data for this period
						</div>
					)}
				</div>

				{/* Model breakdown */}
				<div className="glass-card p-4">
					<h3 className="text-sm font-semibold mb-4">By Model</h3>
					{modelData.length > 0 ? (
						<>
							<ResponsiveContainer width="100%" height={180}>
								<PieChart>
									<Pie
										data={modelData}
										dataKey="value"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={70}
										strokeWidth={0}
									>
										{modelData.map((_, i) => (
											<Cell key={modelData[i]?.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											background: '#222',
											border: '1px solid #333',
											borderRadius: '8px',
											fontSize: '12px',
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
							<div className="space-y-1 mt-2">
								{modelData.map((m, i) => (
									<div key={m.name} className="flex items-center gap-2 text-xs">
										<span
											className="w-2 h-2 rounded-full"
											style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
										/>
										<span className="text-[var(--color-muted-foreground)] truncate">{m.name}</span>
										<span className="ml-auto font-mono">{formatNumber(m.value)}</span>
									</div>
								))}
							</div>
						</>
					) : (
						<div className="h-[180px] flex items-center justify-center text-[var(--color-muted-foreground)]">
							No data
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="glass-card p-4">
			<p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
			<p className="text-xl font-semibold mt-1">{value}</p>
		</div>
	);
}

function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toString();
}
