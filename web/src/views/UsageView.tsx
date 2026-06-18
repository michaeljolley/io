import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { SquadChip } from "@/components/ui";
import { uuid } from "@/lib/uuid";
import { useAuthStore } from "@/stores/auth";

interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface UsageGroup {
  id: string;
  name: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
  cost: number;
}

interface DailyUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(diff + 1, 1);
}

async function authJson<T>(paths: string[]): Promise<T> {
  const token = useAuthStore.getState().token;

  for (let index = 0; index < paths.length; index += 1) {
    const res = await fetch(paths[index], {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    if (res.status === 404 && index < paths.length - 1) {
      continue;
    }

    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }

  throw new Error("Request failed");
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSummary(data: Record<string, unknown>): UsageSummary {
  return {
    totalTokens: toNumber(data.total_tokens ?? data.totalTokens),
    totalCost: toNumber(data.total_cost ?? data.totalCost ?? data.cost),
    totalCalls: toNumber(data.total_calls ?? data.totalCalls ?? data.total_records),
    totalInputTokens: toNumber(data.total_input_tokens ?? data.totalInputTokens),
    totalOutputTokens: toNumber(data.total_output_tokens ?? data.totalOutputTokens),
  };
}

function normalizeGroup(data: Record<string, unknown>): UsageGroup {
  return {
    id: String(data.id ?? data.name ?? uuid()),
    name: String(data.name ?? "Unknown"),
    inputTokens: toNumber(data.total_input_tokens ?? data.input_tokens ?? data.inputTokens),
    outputTokens: toNumber(data.total_output_tokens ?? data.output_tokens ?? data.outputTokens),
    totalTokens: toNumber(data.total_tokens ?? data.totalTokens),
    calls: toNumber(data.total_calls ?? data.calls ?? data.record_count),
    cost: toNumber(data.total_cost ?? data.cost),
  };
}

function normalizeDaily(data: Record<string, unknown>): DailyUsage {
  return {
    date: String(data.date ?? ""),
    inputTokens: toNumber(data.total_input_tokens ?? data.input_tokens ?? data.inputTokens),
    outputTokens: toNumber(data.total_output_tokens ?? data.output_tokens ?? data.outputTokens),
    totalTokens: toNumber(data.total_tokens ?? data.totalTokens),
    cost: toNumber(data.total_cost ?? data.cost),
  };
}

const tooltipStyle = {
  backgroundColor: "#1F2833",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgb(228 228 231)",
  borderRadius: "12px",
  fontSize: "14px",
};

export default function UsageView() {
  const [range, setRange] = useState(getDefaultRange());
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [squads, setSquads] = useState<UsageGroup[]>([]);
  const [agentsBySquad, setAgentsBySquad] = useState<Record<string, UsageGroup[]>>({});
  const [expandedSquads, setExpandedSquads] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const queryParts = useMemo(() => {
    const from = range.from;
    const to = range.to;
    const days = daysBetween(from, to);
    return {
      summary: [
        `/api/token-usage/summary?from=${from}&to=${to}`,
        `/api/token-usage/summary?since=${from}T00:00:00.000Z`,
      ],
      squads: [
        `/api/token-usage/by-squad?from=${from}&to=${to}`,
        `/api/token-usage/by-squad?since=${from}T00:00:00.000Z`,
      ],
      daily: [`/api/token-usage/daily?from=${from}&to=${to}`, `/api/token-usage/daily?days=${days}`],
      agentPaths: (squadId: string) => [
        `/api/token-usage/by-agent?squad=${encodeURIComponent(squadId)}&from=${from}&to=${to}`,
        `/api/token-usage/by-agent?squad_id=${encodeURIComponent(squadId)}&since=${from}T00:00:00.000Z`,
      ],
    };
  }, [range.from, range.to]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [summaryResponse, squadsResponse, dailyResponse] = await Promise.all([
          authJson<Record<string, unknown>>(queryParts.summary),
          authJson<Record<string, unknown>[]>(queryParts.squads),
          authJson<Record<string, unknown>[]>(queryParts.daily),
        ]);

        setSummary(normalizeSummary(summaryResponse));
        setSquads(Array.isArray(squadsResponse) ? squadsResponse.map(normalizeGroup) : []);
        setDaily(Array.isArray(dailyResponse) ? dailyResponse.map(normalizeDaily) : []);
        setAgentsBySquad({});
        setExpandedSquads({});
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load usage data");
      } finally {
        setLoading(false);
      }
    })();
  }, [queryParts]);

  const toggleSquad = async (squad: UsageGroup) => {
    const isOpen = expandedSquads[squad.id];
    setExpandedSquads((current) => ({ ...current, [squad.id]: !isOpen }));

    if (isOpen || agentsBySquad[squad.id]) return;

    try {
      const response = await authJson<Record<string, unknown>[]>(queryParts.agentPaths(squad.id));
      setAgentsBySquad((current) => ({
        ...current,
        [squad.id]: Array.isArray(response) ? response.map(normalizeGroup) : [],
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load agents");
    }
  };

  const totals = useMemo(() => {
    const totalCost =
      summary?.totalCost ||
      daily.reduce((sum, entry) => sum + entry.cost, 0) ||
      squads.reduce((sum, squad) => sum + squad.cost, 0);
    return {
      totalTokens: summary?.totalTokens ?? 0,
      totalCalls: summary?.totalCalls ?? 0,
      totalCost,
      totalInputTokens: summary?.totalInputTokens ?? 0,
      totalOutputTokens: summary?.totalOutputTokens ?? 0,
    };
  }, [daily, squads, summary]);

  const formatNumber = (value: number) => value.toLocaleString();

  if (loading) {
    return <div className="p-6 text-[14px] font-mono text-zinc-500">Loading usage…</div>;
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto p-6 text-zinc-200 min-h-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl leading-none text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Usage
          </h1>
          <p className="mt-2 text-[14px] font-mono text-zinc-600">Track tokens and activity by squad.</p>
        </div>
        <div className="glass-card border border-white/[0.07] rounded-2xl px-4 py-3 flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-[#66FCF1]" />
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
            className="bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono focus:outline-none focus:border-[#66FCF1]/30"
          />
          <span className="text-[14px] font-mono text-zinc-600">to</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            className="bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono focus:outline-none focus:border-[#66FCF1]/30"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card border border-white/[0.07] rounded-2xl p-5">
          <p className="text-[13px] font-mono uppercase tracking-[0.24em] text-zinc-600">Total tokens</p>
          <p className="mt-3 text-3xl text-white">{formatNumber(totals.totalTokens)}</p>
          <p className="mt-2 text-[14px] font-mono text-zinc-500">
            In {formatNumber(totals.totalInputTokens)} / Out {formatNumber(totals.totalOutputTokens)}
          </p>
        </div>

        <div className="glass-card border border-white/[0.07] rounded-2xl p-5">
          <p className="text-[13px] font-mono uppercase tracking-[0.24em] text-zinc-600">Total calls</p>
          <p className="mt-3 text-3xl text-white">{formatNumber(totals.totalCalls)}</p>
          <p className="mt-2 text-[14px] font-mono text-zinc-500">Counted API usage records</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="glass-card border border-white/[0.07] rounded-2xl p-5 h-[320px]">
          <div className="mb-4">
            <h2 className="text-sm text-white">Daily usage</h2>
            <p className="text-[14px] font-mono text-zinc-600">Input vs output tokens</p>
          </div>
          <ResponsiveContainer width="100%" height="82%">
            <BarChart data={daily}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={13} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={13} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#e4e4e7" }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="inputTokens" name="Input Tokens" fill="#66FCF1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="outputTokens" name="Output Tokens" fill="#45A29E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm text-white">Squad breakdown</h2>
          <p className="mt-1 text-[14px] font-mono text-zinc-600">Expand a squad to inspect individual agents.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[14px] font-mono">
            <thead className="bg-white/[0.02] text-zinc-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-right font-medium">Input Tokens</th>
                <th className="px-5 py-3 text-right font-medium">Output Tokens</th>
                <th className="px-5 py-3 text-right font-medium">Calls</th>
              </tr>
            </thead>
            {squads.map((squad) => {
              const open = !!expandedSquads[squad.id];
              const agents = agentsBySquad[squad.id] ?? [];

              return (
                <tbody key={squad.id}>
                  <tr
                    onClick={() => void toggleSquad(squad)}
                    className="cursor-pointer border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                        <SquadChip name={squad.name} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-300">{formatNumber(squad.inputTokens)}</td>
                    <td className="px-5 py-3 text-right text-zinc-300">{formatNumber(squad.outputTokens)}</td>
                    <td className="px-5 py-3 text-right text-zinc-300">{formatNumber(squad.calls)}</td>
                  </tr>
                  {open
                    ? agents.map((agent) => (
                        <tr key={`${squad.id}-${agent.id}`} className="border-t border-white/[0.04] bg-white/[0.01]">
                          <td className="px-5 py-3 pl-11 text-zinc-400">↳ {agent.name}</td>
                          <td className="px-5 py-3 text-right text-zinc-400">{formatNumber(agent.inputTokens)}</td>
                          <td className="px-5 py-3 text-right text-zinc-400">{formatNumber(agent.outputTokens)}</td>
                          <td className="px-5 py-3 text-right text-zinc-400">{formatNumber(agent.calls)}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </div>
  );
}
