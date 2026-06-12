import { AlertTriangle, Bot, CheckCircle, ExternalLink, Loader, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Chip, IoMark, StatusDot, type StatusKind, squadColor, statusToVariant } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";

interface Squad {
  id: string;
  name: string;
  slug: string;
  universe: string;
  color: string;
  repo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  squad_id: string;
  character_name: string;
  role_title: string;
  status: string;
  is_lead: number;
  is_qa: number;
  is_test: number;
}

interface SquadTask {
  id: string;
  description: string;
  status: string;
  created_at: string;
}

interface SquadsResponse {
  squads: Squad[];
  agents: Agent[];
  instanceCounts: Record<string, number>;
  recentTasks: Record<string, SquadTask[]>;
  maxInstancesPerSquad: number;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const auth = useAuthStore.getState();
  if (auth.token && isTokenExpired(auth.token)) {
    await auth.refreshToken();
  }

  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  if (response.status === 401 && retry) {
    await useAuthStore.getState().refreshToken();
    return authFetch(path, init, false);
  }
  return response;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await authFetch(path);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeStatus(status?: string | null): StatusKind {
  const value = (status ?? "").toLowerCase();
  if (value.includes("fail") || value.includes("error")) return "error";
  if (value.includes("review")) return "reviewing";
  if (value.includes("work") || value.includes("progress") || value.includes("run")) return "working";
  if (value.includes("disconnect")) return "disconnected";
  if (value.includes("connect")) return "connected";
  return "idle";
}

function overallStatus(agents: Agent[], instanceCount: number): StatusKind {
  const statuses = agents.map((agent) => normalizeStatus(agent.status));
  if (statuses.includes("error")) return "error";
  if (statuses.includes("working") || statuses.includes("reviewing")) return "working";
  if (instanceCount > 0) return "connected";
  return "idle";
}

function ActivityIcon({ status }: { status: StatusKind }) {
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (status === "working" || status === "reviewing")
    return <Loader className="h-3.5 w-3.5 text-[#66FCF1] animate-spin" />;
  if (status === "disconnected") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
}

function taskStatusKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === "failed" || s === "error") return "error";
  if (s === "in_progress" || s === "running" || s === "working") return "working";
  if (s === "completed" || s === "done") return "connected";
  if (s === "pending" || s === "queued") return "idle";
  return "idle";
}

function snippetDescription(description: string, maxLen = 60): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export default function SquadsView() {
  const navigate = useNavigate();
  const [data, setData] = useState<SquadsResponse>({ squads: [], agents: [], instanceCounts: {}, recentTasks: {}, maxInstancesPerSquad: 3 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await fetchJson<SquadsResponse>("/api/squads"));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const agentsBySquad = useMemo(() => {
    return data.agents.reduce<Record<string, Agent[]>>((acc, agent) => {
      acc[agent.squad_id] ??= [];
      acc[agent.squad_id].push(agent);
      return acc;
    }, {});
  }, [data.agents]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="p-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl text-zinc-100 leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              Squads
            </h1>
            <p className="mt-2 text-[11px] font-mono text-zinc-500">
              {data.squads.length} squad{data.squads.length === 1 ? "" : "s"} loaded.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="glass-card border border-white/[0.07] rounded-2xl p-10 text-center text-[11px] font-mono text-zinc-500">
            Loading squads…
          </div>
        ) : data.squads.length === 0 ? (
          <div className="border border-white/[0.07] rounded-2xl p-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/10 text-[#66FCF1] mb-4">
              <IoMark height={28} />
            </div>
            <p className="text-zinc-100 text-lg">No existing squads</p>
            <p className="text-[11px] font-mono text-zinc-500 mt-2">
              Ask IO to create a squad to see them listed here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.squads.map((squad) => {
              const color = squad.color || squadColor(squad.name) || "#66FCF1";
              const squadAgents = agentsBySquad[squad.id] ?? [];
              const instanceCount = data.instanceCounts[squad.id] ?? 0;
              const status = overallStatus(squadAgents, instanceCount);
              const hovering = hoveredId === squad.id;
              const recentActivity = data.recentTasks[squad.id] ?? [];

              return (
                <div
                  key={squad.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/squads/${squad.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/squads/${squad.id}`);
                    }
                  }}
                  onMouseEnter={() => setHoveredId(squad.id)}
                  onMouseLeave={() => setHoveredId((current) => (current === squad.id ? null : current))}
                  className="glass-card rounded-2xl p-5 gap-1 flex flex-col transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-[#66FCF1]/30"
                  style={{
                    border: `1px solid ${hovering ? `${color}70` : `${color}30`}`,
                    background: hovering ? `${color}12` : `${color}08`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="h-1 w-12 rounded-full mb-4" style={{ background: color }} />
                      <h2
                        className="text-3xl text-zinc-100 leading-none"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {squad.name}
                      </h2>
                      <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                        {squad.universe}
                      </p>
                    </div>
                    <Chip variant={statusToVariant(status)}>{status}</Chip>
                  </div>

                  <div className="mt-1 flex justify-between text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center gap-2 text-zinc-200">
                      <Users className="h-3.5 w-3.5" style={{ color }} /> {squadAgents.length} agents
                    </div>
                    <div className="flex items-center gap-2 text-zinc-200">
                      <Bot className="h-3.5 w-3.5" style={{ color }} /> {instanceCount}/{data.maxInstancesPerSquad} instances
                    </div>
                  </div>

                  <div className="text-[11px] font-mono">
                    {squad.repo_url ? (
                      <a
                        href={squad.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className={`mt-2 inline-flex items-center hover:underline gap-1.5 break-all`}
                        style={{ color }}
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        {squad.repo_url}
                      </a>
                    ) : (
                      <p className="mt-2 text-zinc-600">No repository linked</p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">
                      Recent Objectives
                    </p>
                    <div className="space-y-2">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((task) => {
                          const taskStatus = taskStatusKind(task.status);
                          return (
                            <div key={task.id} className="flex items-center gap-2.5 text-sm text-zinc-200">
                              <ActivityIcon status={taskStatus} />
                              <span className="truncate flex-1 text-[11px] font-mono">
                                {snippetDescription(task.description)}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 shrink-0">
                                <StatusDot status={taskStatus} />
                                {task.status}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] font-mono text-zinc-600">No objectives yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
