import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Bug,
  CheckCircle,
  ChevronLeft,
  Clock,
  Crown,
  ExternalLink,
  Eye,
  GitBranch,
  Hash,
  Loader,
  MessageSquare,
  ScrollText,
  Square,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chip, DangerBtn, SecondaryBtn, type StatusKind, statusToVariant, Toggle } from "@/components/ui";
import { GlassCard } from "@/components/ui/GlassCard";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useAuthStore } from "@/stores/auth";

interface SquadDetail {
  id: string;
  name: string;
  slug: string;
  universe: string;
  color: string;
  repo_url: string | null;
  rules: string;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  squad_id: string;
  character_name: string;
  role_title: string;
  persona: string;
  is_lead: number;
  is_qa: number;
  is_test: number;
  status: string;
  created_at: string;
}

interface Instance {
  id: string;
  squad_id: string;
  branch: string;
  worktree_path: string;
  status: string;
  last_activity: string;
  created_at: string;
}

interface Task {
  id: string;
  squad_id: string;
  instance_id: string | null;
  agent_id: string | null;
  description: string;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

interface Schedule {
  id: string;
  type: "squad" | "io";
  squad_id: string | null;
  cron: string;
  agenda: string;
  prompt: string;
  enabled: number;
  last_run: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  squad_id: string | null;
  agent_id: string | null;
  task_id: string | null;
  action_type: string;
  summary: string;
  payload: string;
  created_at: string;
}

interface AgentEvent {
  id: string;
  task_id: string;
  agent_name?: string;
  type: string;
  summary: string;
  payload: string;
  created_at: string;
}

interface SquadDetailResponse {
  squad: SquadDetail;
  agents: Agent[];
  tasks: Task[];
  instances: Instance[];
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

type TabKey = "agents" | "instances" | "schedules" | "history";

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

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(path, init);
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

function isActiveTask(task: Task): boolean {
  return !["done", "failed", "stopped", "cancelled"].includes(task.status);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function activityStatus(status: StatusKind) {
  if (status === "error") return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "working" || status === "reviewing") return <Loader className="h-4 w-4 text-[#66FCF1] animate-spin" />;
  if (status === "disconnected") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <CheckCircle className="h-4 w-4 text-green-400" />;
}

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

const KIND_META: Record<string, { label: string; icon: React.ElementType }> = {
  thought: { label: "Thinking", icon: MessageSquare },
  tool_call: { label: "Tool Call", icon: Terminal },
  tool_result: { label: "Tool Result", icon: Hash },
  message: { label: "Message", icon: Bot },
  decision: { label: "Decision", icon: Crown },
};

function mapEventTypeToKind(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("tool_call") || lower.includes("toolcall")) return "tool_call";
  if (lower.includes("tool_result") || lower.includes("toolresult")) return "tool_result";
  if (lower.includes("think") || lower.includes("thought")) return "thought";
  if (lower.includes("decision") || lower.includes("assign")) return "decision";
  return "message";
}

export default function SquadDetailView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("agents");
  const [squad, setSquad] = useState<SquadDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);
  const [destroyingId, setDestroyingId] = useState<string | null>(null);
  const [activityTaskId, setActivityTaskId] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<AgentEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [detail, allSchedules, audit] = await Promise.all([
          fetchJson<SquadDetailResponse>(`/api/squads/${id}`),
          fetchJson<Schedule[]>("/api/schedules"),
          fetchJson<AuditResponse>(`/api/audit-log?squad_id=${id}&limit=20`),
        ]);

        setSquad(detail.squad);
        setAgents(detail.agents);
        setInstances(detail.instances);
        setTasks(detail.tasks);
        setSchedules(allSchedules.filter((schedule) => schedule.squad_id === id));
        setAuditEntries(audit.entries);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const currentTaskByAgent = useMemo(() => {
    return agents.reduce<Record<string, Task | undefined>>((acc, agent) => {
      acc[agent.id] = tasks.find((task) => task.agent_id === agent.id && isActiveTask(task));
      return acc;
    }, {});
  }, [agents, tasks]);

  const currentTaskByInstance = useMemo(() => {
    return instances.reduce<Record<string, Task | undefined>>((acc, instance) => {
      acc[instance.id] = tasks.find((task) => task.instance_id === instance.id && isActiveTask(task));
      return acc;
    }, {});
  }, [instances, tasks]);

  const overallStatus = useMemo<StatusKind>(() => {
    const statuses = agents.map((agent) => normalizeStatus(agent.status));
    if (statuses.includes("error")) return "error";
    if (statuses.includes("working") || statuses.includes("reviewing")) return "working";
    if (instances.length > 0) return "connected";
    return "idle";
  }, [agents, instances.length]);

  const historyItems = useMemo(() => {
    if (auditEntries.length > 0) {
      return auditEntries.map((entry) => {
        const task = tasks.find((candidate) => candidate.id === entry.task_id);
        const status = normalizeStatus(task?.status ?? entry.action_type);
        return {
          id: entry.id,
          title: entry.summary,
          timestamp: entry.created_at,
          duration: task ? formatDuration(task.created_at, task.updated_at) : "—",
          agentCount: entry.agent_id || task?.agent_id ? 1 : 0,
          status,
        };
      });
    }

    return tasks.slice(0, 20).map((task) => ({
      id: task.id,
      title: task.description,
      timestamp: task.updated_at,
      duration: formatDuration(task.created_at, task.updated_at),
      agentCount: task.agent_id ? 1 : 0,
      status: normalizeStatus(task.status),
    }));
  }, [auditEntries, tasks]);

  const timelineAgentColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of activityEvents) {
      const name = event.agent_name || "Agent";
      if (!map[name]) map[name] = agentColor(name);
    }
    return map;
  }, [activityEvents]);

  const timelineAgentNames = useMemo(
    () => [...new Set(activityEvents.map((e) => e.agent_name || "Agent"))],
    [activityEvents],
  );

  const filteredTimelineEvents = useMemo(() => {
    if (selectedAgents.size === 0) return activityEvents;
    return activityEvents.filter((e) => selectedAgents.has(e.agent_name || "Agent"));
  }, [activityEvents, selectedAgents]);

  const loadActivity = async (taskId: string) => {
    setActivityTaskId(taskId);
    setActivityLoading(true);
    setSelectedAgents(new Set());
    try {
      setActivityEvents(await fetchJson<AgentEvent[]>(`/api/tasks/${taskId}/events`));
    } finally {
      setActivityLoading(false);
    }
  };

  const stopTask = async (taskId: string, agentId?: string | null) => {
    setStoppingTaskId(taskId);
    try {
      await fetchJson<{ ok: true }>(`/api/tasks/${taskId}/stop`, { method: "POST" });
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: "stopped", updated_at: new Date().toISOString() } : task,
        ),
      );
      if (agentId) {
        setAgents((prev) => prev.map((agent) => (agent.id === agentId ? { ...agent, status: "idle" } : agent)));
      }
    } finally {
      setStoppingTaskId(null);
    }
  };

  const destroyInstance = async (instanceId: string) => {
    setDestroyingId(instanceId);
    try {
      await fetchJson<{ ok: true }>(`/api/instances/${instanceId}`, { method: "DELETE" });
      setInstances((prev) => prev.filter((instance) => instance.id !== instanceId));
    } finally {
      setDestroyingId(null);
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    const updated = await fetchJson<Schedule>(`/api/schedules/${schedule.id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: !schedule.enabled }),
    });
    setSchedules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  if (loading) {
    return <div className="p-6 text-[11px] font-mono text-zinc-500">Loading squad…</div>;
  }

  if (!squad) {
    return <div className="p-6 text-[11px] font-mono text-zinc-500">Squad not found.</div>;
  }

  const tabs: TabKey[] = ["agents", "instances", "schedules", "history"];

  // If viewing activity detail, show the timeline view instead of the main view
  if (activityTaskId) {
    const selectedHistoryItem = historyItems.find((item) => item.id === activityTaskId);

    const toggleAgent = (name: string) => {
      setSelectedAgents((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    };

    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-5">
          <button
            onClick={() => {
              setActivityTaskId(null);
              setActivityEvents([]);
              setSelectedAgents(new Set());
            }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 font-mono transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to {squad.name}
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h2
                className="text-2xl tracking-wide"
                style={{ fontFamily: "'Bebas Neue', sans-serif", color: squad.color || "#66FCF1" }}
              >
                {selectedHistoryItem?.title || "Task Activity"}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-zinc-600 font-mono">
                  {formatTimestamp(selectedHistoryItem?.timestamp)}
                </span>
                {selectedHistoryItem?.duration && (
                  <span className="text-[11px] text-zinc-700 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedHistoryItem.duration}
                  </span>
                )}
              </div>
            </div>
            {selectedHistoryItem && (
              <Chip variant={statusToVariant(selectedHistoryItem.status)}>{selectedHistoryItem.status}</Chip>
            )}
          </div>

          {/* Agent legend */}
          {timelineAgentNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {timelineAgentNames.map((name) => {
                const color = timelineAgentColors[name];
                const isFiltering = selectedAgents.size > 0;
                const isActive = !isFiltering || selectedAgents.has(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleAgent(name)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer"
                    style={{
                      borderColor: isActive ? `${color}30` : "rgba(255,255,255,0.05)",
                      background: isActive ? `${color}10` : "transparent",
                      opacity: isActive ? 1 : 0.4,
                    }}
                  >
                    <Bot className="w-3 h-3" style={{ color: isActive ? color : "#71717a" }} />
                    <span className="text-[11px] font-mono" style={{ color: isActive ? color : "#71717a" }}>
                      {name}
                    </span>
                  </button>
                );
              })}
              {selectedAgents.size > 0 && (
                <button
                  onClick={() => setSelectedAgents(new Set())}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Show all
                </button>
              )}
            </div>
          )}

          {/* Unified timeline */}
          {activityLoading ? (
            <p className="text-[11px] font-mono text-zinc-500 py-10 text-center">Loading activity…</p>
          ) : filteredTimelineEvents.length === 0 ? (
            <p className="text-[11px] font-mono text-zinc-500 py-10 text-center">No events recorded for this task.</p>
          ) : (
            <div className="relative pl-10">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/[0.06]" />
              <div className="space-y-3">
                {filteredTimelineEvents.map((event) => {
                  const name = event.agent_name || "Agent";
                  const color = timelineAgentColors[name] || "#66FCF1";
                  const kind = mapEventTypeToKind(event.type);
                  const meta = KIND_META[kind] || KIND_META.message;
                  const KindIcon = meta.icon;
                  const isCode = kind === "tool_call" || kind === "tool_result";

                  return (
                    <div key={event.id} className="relative">
                      <div
                        className="absolute -left-10 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center"
                        style={{ background: `${color}15`, border: `1px solid ${color}35` }}
                      >
                        <KindIcon className="w-3.5 h-3.5" style={{ color }} />
                      </div>

                      <div className="glass-card border border-white/[0.07] rounded-2xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Bot className="w-3 h-3" style={{ color }} />
                              <span className="text-[10px] font-mono" style={{ color }}>
                                {name}
                              </span>
                            </div>
                            <span className="text-zinc-700 text-[10px]">·</span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                              {meta.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0 ml-2">
                            {formatTimestamp(event.created_at)}
                          </span>
                        </div>
                        {isCode ? (
                          <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed overflow-x-auto rounded-lg p-2 mt-1 bg-black/20">
                            {event.summary || event.payload}
                          </pre>
                        ) : (
                          <MarkdownRenderer
                            content={event.summary || event.payload || ""}
                            className="text-[12px] [&_pre]:text-[10px]"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <SecondaryBtn onClick={() => navigate("/squads")} className="px-3 py-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          All Squads
        </SecondaryBtn>

        <section>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1
                className="text-5xl leading-none mt-2 flex items-start gap-4 flex-wrap"
                style={{ fontFamily: "'Bebas Neue', sans-serif", color: squad.color || "#66FCF1" }}
              >
                {squad.name} <Chip variant={statusToVariant(overallStatus)}>{overallStatus}</Chip>
              </h1>
              <div className="flex flex-col flex-wrap items-start gap-2 text-[11px] font-mono">
                <p className="muted">{squad.universe}</p>
                <p>
                  {squad.repo_url && (
                    <a
                      href={squad.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                      style={{ color: squad.color || "#66FCF1" }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {squad.repo_url}
                    </a>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 xl:min-w-[360px]">
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3">
                <p
                  className="text-[11px] font-mono uppercase tracking-wide text-zinc-500"
                  style={{ color: squad.color || "#66FCF1" }}
                >
                  Agents
                </p>
                <p className="mt-2 text-2xl text-zinc-100">{agents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3">
                <p
                  className="text-[11px] font-mono uppercase tracking-wide text-zinc-500"
                  style={{ color: squad.color || "#66FCF1" }}
                >
                  Instances
                </p>
                <p className="mt-2 text-2xl text-zinc-100">{instances.length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3">
                <p
                  className="text-[11px] font-mono uppercase tracking-wide text-zinc-500"
                  style={{ color: squad.color || "#66FCF1" }}
                >
                  Tasks
                </p>
                <p className="mt-2 text-2xl text-zinc-100">{tasks.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 px-4 border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`cursor-pointer px-2 pb-2 text-[11px] border-b font-mono uppercase tracking-[0.18em] transition-color ${activeTab !== tab ? "hover:text-zinc-300" : ""}`}
              style={{
                borderColor: activeTab === tab ? squad.color : "transparent",
                color: activeTab === tab ? squad.color : "var(--base-gray)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "agents" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const currentTask = currentTaskByAgent[agent.id];
              const status = normalizeStatus(agent.status);
              const Icon = agent.is_lead
                ? Crown
                : agent.is_qa || agent.is_test
                  ? Bug
                  : /scribe|writer|doc/i.test(`${agent.role_title} ${agent.persona}`)
                    ? ScrollText
                    : Bot;

              return (
                <GlassCard key={agent.id} color={squad.color}>
                  <div className="flex">
                    <div className="flex flex-col w-full gap-1.5 justify-between">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-xl border flex items-center justify-center"
                            style={{
                              borderColor: `${squad.color}40`,
                              background: `${squad.color}15`,
                              color: squad.color || "#66FCF1",
                            }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 flex-wrap">
                              <h3 className="text-sm truncate">{agent.character_name}</h3>
                            </div>
                            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                              {agent.role_title?.trim() || "Agent"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 flex-shrink-0">
                          <Chip variant={statusToVariant(status)}>{agent.status || "idle"}</Chip>
                        </div>
                      </div>
                      <div className="min-w-0 flex">
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {currentTask?.description ?? "No active task assigned."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {currentTask && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SecondaryBtn onClick={() => void loadActivity(currentTask.id)} className="px-2.5 py-1.5">
                        <Eye className="h-3 w-3" />
                        View Activity
                      </SecondaryBtn>
                      {(status === "working" || status === "reviewing") && (
                        <DangerBtn
                          onClick={() => void stopTask(currentTask.id, agent.id)}
                          className={`px-2.5 py-1.5 ${stoppingTaskId === currentTask.id ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <Square className="h-3 w-3" />
                          Stop
                        </DangerBtn>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}

        {activeTab === "instances" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {instances.length === 0 ? (
              <div className="glass-card border border-white/[0.07] rounded-2xl p-10 text-center col-span-full">
                <p className="text-zinc-100 mt-4">No active instances</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-2">
                  Ask IO to spin up an instance to see it here.
                </p>
              </div>
            ) : (
              instances.map((instance) => {
                const task = currentTaskByInstance[instance.id];
                return (
                  <div key={instance.id} className="glass-card border border-white/[0.07] rounded-2xl p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                      <div>
                        <p className="text-zinc-500 uppercase tracking-wide">ID</p>
                        <p className="text-zinc-200 mt-1 break-all">{instance.id}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 uppercase tracking-wide">Branch</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-zinc-200">
                          <GitBranch className="h-3.5 w-3.5 text-[#66FCF1]" />
                          {instance.branch}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 uppercase tracking-wide">Created</p>
                        <p className="text-zinc-200 mt-1">{formatTimestamp(instance.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 uppercase tracking-wide">Task</p>
                        <p className="text-zinc-200 mt-1">{task?.description ?? "Idle"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {task && (
                        <SecondaryBtn onClick={() => void loadActivity(task.id)} className="px-3 py-2">
                          <Eye className="h-3.5 w-3.5" />
                          View Activity
                        </SecondaryBtn>
                      )}
                      <DangerBtn
                        onClick={() => void destroyInstance(instance.id)}
                        className={`px-3 py-2 ${destroyingId === instance.id ? "pointer-events-none opacity-50" : ""}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Destroy
                      </DangerBtn>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "schedules" && (
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <div className="glass-card border border-white/[0.07] rounded-2xl p-10 text-center col-span-full">
                <p className="text-zinc-100 mt-4">No schedules configured</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-2">
                  Scheduled automations for this squad will appear here.
                </p>
              </div>
            ) : (
              schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="glass-card border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip variant={schedule.enabled ? "success" : "muted"}>
                        {schedule.enabled ? "enabled" : "paused"}
                      </Chip>
                      <span className="text-[11px] font-mono text-zinc-500">{schedule.cron}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wide text-zinc-500">Agenda</p>
                      <p className="text-zinc-200 mt-1">{schedule.agenda || "No agenda supplied."}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wide text-zinc-500">Prompt</p>
                      <p className="text-zinc-400 mt-1 whitespace-pre-wrap">
                        {schedule.prompt || "No prompt configured."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
                    <span>Last run {formatTimestamp(schedule.last_run)}</span>
                    <Toggle checked={Boolean(schedule.enabled)} onChange={() => void toggleSchedule(schedule)} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {historyItems.length === 0 ? (
              <div className="glass-card border border-white/[0.07] rounded-2xl p-10 text-center col-span-full">
                <p className="text-zinc-100 mt-4">No history yet</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-2">
                  Task updates and audit events will be listed here.
                </p>
              </div>
            ) : (
              historyItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void loadActivity(item.id)}
                  className="w-full glass-card border border-white/[0.07] rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
                >
                  <div className="flex-shrink-0">{activityStatus(item.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-zinc-200 font-mono truncate">{item.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-zinc-700 font-mono">{formatTimestamp(item.timestamp)}</span>
                      <span className="text-[10px] text-zinc-700 font-mono flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5" />
                        {item.duration}
                      </span>
                      <span className="text-[10px] text-zinc-700 font-mono flex items-center gap-1">
                        <Bot className="w-2.5 h-2.5" />
                        {item.agentCount} agent{item.agentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <Chip variant={statusToVariant(item.status)}>{item.status}</Chip>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
