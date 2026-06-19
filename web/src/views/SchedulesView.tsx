import { Clock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, DangerBtn, PrimaryBtn, SecondaryBtn, SquadChip, WarnBtn } from "@/components/ui";
import { describeCron } from "@/lib/cron";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

interface Schedule {
  id: string;
  type: "io" | "squad";
  squad_id: string | null;
  cron: string;
  agenda: string;
  prompt: string;
  enabled: boolean | number;
  last_run: string | null;
  created_at: string;
  name?: string;
}

interface Squad {
  id: string;
  name: string;
  color?: string;
}

interface SquadsResponse {
  schedules?: Schedule[];
  squads?: Squad[];
}

interface ScheduleDraft {
  type: "io" | "squad";
  squadId: string;
  cron: string;
  agenda: string;
  prompt: string;
}

const GLASS_CARD = "glass-card border border-white/[0.07] rounded-2xl";
const INPUT_CLASS =
  "bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30";
const SECTION_HEADER = "text-[13px] font-mono text-zinc-700 uppercase tracking-wider";
const MODAL_BACKDROP = {
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
} as const;

function emptyDraft(squads: Squad[], type: "io" | "squad"): ScheduleDraft {
  return {
    type,
    squadId: squads[0]?.id ?? "",
    cron: "",
    agenda: "",
    prompt: "",
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers ?? {});

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as { error?: string };
      if (errorBody.error) {
        message = errorBody.error;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseNumber(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function parseDaysOfWeek(dayOfWeek: string): number[] {
  const names: Record<string, number> = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  const values = new Set<number>();
  for (const token of dayOfWeek.split(",")) {
    const part = token.trim().toUpperCase();
    if (!part) continue;

    if (part.includes("-")) {
      const [startToken, endToken] = part.split("-");
      const start = names[startToken] ?? parseNumber(startToken) ?? 0;
      const end = names[endToken] ?? parseNumber(endToken) ?? 0;
      if (start <= end) {
        for (let value = start; value <= end; value += 1) values.add(value % 7);
      } else {
        for (let value = start; value < 7; value += 1) values.add(value);
        for (let value = 0; value <= end; value += 1) values.add(value);
      }
      continue;
    }

    const number = names[part] ?? parseNumber(part);
    if (number != null) {
      values.add(number % 7);
    }
  }

  return values.size ? [...values].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

function getNextRunLabel(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    return "—";
  }

  const now = new Date();
  const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = parts;

  if (minutePart === "*" && hourPart === "*" && dayOfMonthPart === "*" && monthPart === "*" && dayOfWeekPart === "*") {
    const next = new Date(now.getTime() + 60_000);
    return formatDateTime(next);
  }

  if (
    minutePart.startsWith("*/") &&
    hourPart === "*" &&
    dayOfMonthPart === "*" &&
    monthPart === "*" &&
    dayOfWeekPart === "*"
  ) {
    const interval = Number.parseInt(minutePart.slice(2), 10);
    if (Number.isFinite(interval) && interval > 0) {
      const next = new Date(now);
      next.setSeconds(0, 0);
      next.setMinutes(Math.floor(now.getMinutes() / interval) * interval + interval);
      return formatDateTime(next);
    }
  }

  const minute = parseNumber(minutePart);
  const hour = parseNumber(hourPart);
  const dayOfMonth = parseNumber(dayOfMonthPart);

  if (minute != null && hourPart === "*" && dayOfMonthPart === "*" && monthPart === "*" && dayOfWeekPart === "*") {
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(minute, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return formatDateTime(next);
  }

  if (minute != null && hour != null && dayOfMonthPart === "*" && monthPart === "*" && dayOfWeekPart === "*") {
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return formatDateTime(next);
  }

  if (minute != null && hour != null && dayOfMonthPart === "*" && monthPart === "*" && dayOfWeekPart !== "*") {
    const allowedDays = parseDaysOfWeek(dayOfWeekPart);
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(hour, minute, 0, 0);
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(next);
      candidate.setDate(next.getDate() + offset);
      if (allowedDays.includes(candidate.getDay()) && candidate > now) {
        return formatDateTime(candidate);
      }
    }
  }

  if (minute != null && hour != null && dayOfMonth != null && monthPart === "*" && dayOfWeekPart === "*") {
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(hour, minute, 0, 0);
    next.setDate(dayOfMonth);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1, dayOfMonth);
    }
    return formatDateTime(next);
  }

  return describeCron(expression);
}

export default function SchedulesView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [tab, setTab] = useState<"squad" | "io">("squad");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(() => emptyDraft([], "squad"));
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleData, squadData] = await Promise.all([
        requestJson<Schedule[]>("/api/schedules"),
        requestJson<SquadsResponse>("/api/squads"),
      ]);
      setSchedules(scheduleData);
      setSquads(Array.isArray(squadData.squads) ? squadData.squads : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleSchedules = useMemo(() => schedules.filter((schedule) => schedule.type === tab), [schedules, tab]);

  const squadLookup = useMemo(() => {
    const map = new Map<string, Squad>();
    for (const squad of squads) {
      map.set(squad.id, squad);
    }
    return map;
  }, [squads]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(squads, tab));
    setShowModal(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setDraft({
      type: schedule.type,
      squadId: schedule.squad_id ?? "",
      cron: schedule.cron,
      agenda: schedule.agenda || schedule.name || "",
      prompt: schedule.prompt,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const saveSchedule = async () => {
    const squadId = draft.type === "squad" ? draft.squadId : draft.squadId || squads[0]?.id || "";
    if (!draft.cron.trim()) {
      setError("Cron expression is required.");
      return;
    }
    if (draft.type === "squad" && !draft.squadId) {
      setError("Choose a squad schedule target.");
      return;
    }
    if (!squadId) {
      setError("Create at least one squad before saving schedules.");
      return;
    }

    setBusyKey("save");
    try {
      if (editingId) {
        const updated = await requestJson<Schedule>(`/api/schedules/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            cron: draft.cron.trim(),
            agenda: draft.agenda.trim(),
            prompt: draft.prompt,
          }),
        });
        setSchedules((current) => current.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await requestJson<Schedule>("/api/schedules", {
          method: "POST",
          body: JSON.stringify({
            type: draft.type,
            squad_id: squadId,
            cron: draft.cron.trim(),
            agenda: draft.agenda.trim(),
            prompt: draft.prompt,
          }),
        });
        setSchedules((current) => [...current, created]);
      }
      closeModal();
      setError("");
      notifySuccess(editingId ? "Schedule updated" : "Schedule created");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save schedule";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  const toggleEnabled = async (schedule: Schedule) => {
    const enabled = !(schedule.enabled === true || schedule.enabled === 1);
    setBusyKey(`toggle:${schedule.id}`);
    try {
      const updated = await requestJson<Schedule>(`/api/schedules/${schedule.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setSchedules((current) => current.map((item) => (item.id === schedule.id ? updated : item)));
      setError("");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update schedule status");
    } finally {
      setBusyKey("");
    }
  };

  const triggerNow = async (schedule: Schedule) => {
    setBusyKey(`trigger:${schedule.id}`);
    try {
      const response = await requestJson<{ ok: boolean; schedule?: Schedule }>(
        `/api/schedules/${schedule.id}/trigger`,
        {
          method: "POST",
        },
      );
      if (response.schedule) {
        setSchedules((current) => current.map((item) => (item.id === schedule.id ? response.schedule! : item)));
      }
      setError("");
      notifySuccess("Schedule triggered");
    } catch (triggerError) {
      const message = triggerError instanceof Error ? triggerError.message : "Failed to trigger schedule";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  const removeSchedule = async (schedule: Schedule) => {
    setBusyKey(`remove:${schedule.id}`);
    try {
      await requestJson(`/api/schedules/${schedule.id}`, { method: "DELETE" });
      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      setError("");
      notifySuccess("Schedule deleted");
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : "Failed to delete schedule";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl leading-none text-zinc-100" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Schedules
          </h1>
        </div>
        <PrimaryBtn onClick={openCreate} className="px-3 py-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Schedule
        </PrimaryBtn>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-white/[0.06]">
        {(
          [
            ["squad", "Squad Schedules"],
            ["io", "IO Schedules"],
          ] as const
        ).map(([value, label]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`cursor-pointer px-2 pb-2 text-[14px] border-b font-mono uppercase tracking-[0.18em] transition-colors ${!active ? "hover:text-zinc-300" : ""}`}
              style={{
                borderColor: active ? "#66FCF1" : "transparent",
                color: active ? "#66FCF1" : undefined,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-[14px] font-mono text-red-300">
          {error}
        </div>
      )}

      <div className={`${GLASS_CARD} overflow-hidden`}>
        <table className="w-full text-[14px] font-mono">
          <thead>
            <tr className="border-b border-white/[0.06]" style={{ background: "rgba(20,20,20,0.6)" }}>
              <th className="text-left px-4 py-2.5 text-white font-medium">Schedule</th>
              <th className="text-left px-4 py-2.5 text-white font-medium">Next Run</th>
              <th className="text-left px-4 py-2.5 text-white font-medium">Status</th>
              <th className="text-right px-4 py-2.5 text-white font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                  Loading schedules…
                </td>
              </tr>
            ) : visibleSchedules.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-700">
                  No schedules configured for this tab.
                </td>
              </tr>
            ) : (
              visibleSchedules.map((schedule) => {
                const enabled = schedule.enabled === true || schedule.enabled === 1;
                const squad = schedule.squad_id ? squadLookup.get(schedule.squad_id) : undefined;
                return (
                  <tr key={schedule.id} className="border-b border-white/[0.05] last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <div className="text-zinc-100">
                        {schedule.agenda || schedule.name || describeCron(schedule.cron)}
                      </div>
                      <div className="mt-1 text-zinc-600">{schedule.cron}</div>
                      <div className="mt-2 flex items-center gap-2">
                        {schedule.type === "squad" && squad ? (
                          <SquadChip name={squad.name} color={squad.color} />
                        ) : (
                          <Chip variant="info">io</Chip>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-300">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-[#66FCF1]" />
                        <span>{getNextRunLabel(schedule.cron)}</span>
                      </div>
                      {schedule.last_run && <div className="mt-1 text-zinc-700">Last run {schedule.last_run}</div>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Chip variant={enabled ? "success" : "muted"}>{enabled ? "active" : "paused"}</Chip>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <SecondaryBtn onClick={() => void triggerNow(schedule)} className="px-3 py-1.5">
                          <Play className="h-3.5 w-3.5" />
                          {busyKey === `trigger:${schedule.id}` ? "Running…" : "Run now"}
                        </SecondaryBtn>
                        <WarnBtn onClick={() => void toggleEnabled(schedule)} className="px-3 py-1.5">
                          {busyKey === `toggle:${schedule.id}` ? "Saving…" : enabled ? "Pause" : "Resume"}
                        </WarnBtn>
                        <SecondaryBtn onClick={() => openEdit(schedule)} className="px-3 py-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </SecondaryBtn>
                        <DangerBtn onClick={() => void removeSchedule(schedule)} className="px-3 py-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          {busyKey === `remove:${schedule.id}` ? "Deleting…" : "Delete"}
                        </DangerBtn>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={MODAL_BACKDROP}>
          <div className="glass-card border border-white/[0.09] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl leading-none text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {editingId ? "Edit Schedule" : "New Schedule"}
                </h2>
                <p className="mt-2 text-[14px] font-mono text-zinc-600">
                  Configure cadence, label, and prompt payload.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {!editingId ? (
                <div>
                  <div className={SECTION_HEADER}>Type</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["io", "squad"] as const).map((value) => {
                      const active = draft.type === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setDraft((current) => ({ ...current, type: value }))}
                          className={`rounded-xl border px-3 py-2 text-left text-[14px] font-mono transition-colors cursor-pointer ${
                            active
                              ? "border-[#66FCF1]/30 text-[#66FCF1]"
                              : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                          }`}
                          style={active ? { background: "rgba(102,252,241,0.08)" } : undefined}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className={SECTION_HEADER}>Type</div>
                  <div className="mt-2">
                    <Chip variant={draft.type === "squad" ? "warning" : "info"}>{draft.type}</Chip>
                  </div>
                </div>
              )}

              {draft.type === "squad" && !editingId && (
                <div>
                  <div className={SECTION_HEADER}>Squad</div>
                  <select
                    value={draft.squadId}
                    onChange={(event) => setDraft((current) => ({ ...current, squadId: event.target.value }))}
                    className={`mt-2 w-full ${INPUT_CLASS}`}
                  >
                    <option value="">Select squad</option>
                    {squads.map((squad) => (
                      <option key={squad.id} value={squad.id}>
                        {squad.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draft.type === "squad" && editingId && draft.squadId && squadLookup.get(draft.squadId) && (
                <div>
                  <div className={SECTION_HEADER}>Squad</div>
                  <div className="mt-2">
                    <SquadChip
                      name={squadLookup.get(draft.squadId)!.name}
                      color={squadLookup.get(draft.squadId)!.color}
                    />
                  </div>
                </div>
              )}

              <div>
                <div className={SECTION_HEADER}>Cron Expression</div>
                <input
                  value={draft.cron}
                  onChange={(event) => setDraft((current) => ({ ...current, cron: event.target.value }))}
                  placeholder="0 9 * * 1-5"
                  className={`mt-2 w-full ${INPUT_CLASS}`}
                />
              </div>

              <div>
                <div className={SECTION_HEADER}>Human Label</div>
                <input
                  value={draft.agenda}
                  onChange={(event) => setDraft((current) => ({ ...current, agenda: event.target.value }))}
                  placeholder="Morning standup summary"
                  className={`mt-2 w-full ${INPUT_CLASS}`}
                />
              </div>

              <div>
                <div className={SECTION_HEADER}>Prompt</div>
                <textarea
                  value={draft.prompt}
                  onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                  placeholder="Summarize work in progress and blockers."
                  className={`mt-2 min-h-[150px] w-full resize-y ${INPUT_CLASS}`}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <SecondaryBtn onClick={closeModal} className="px-3 py-1.5">
                Cancel
              </SecondaryBtn>
              <PrimaryBtn onClick={() => void saveSchedule()} className="px-3 py-1.5">
                {busyKey === "save" ? "Saving…" : "Save"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
