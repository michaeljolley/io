import { ChevronDown, ChevronRight, Plus, Server, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Chip, DangerBtn, PrimaryBtn, SecondaryBtn, StatusDot, Toggle } from "@/components/ui";
import { notifyError, notifySuccess } from "@/lib/notify";
import { uuid } from "@/lib/uuid";
import { useAuthStore } from "@/stores/auth";

interface McpTool {
  name: string;
  description: string;
  enabled: boolean;
}

interface McpServer {
  id: string;
  name: string;
  type: "stdio" | "http";
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  tools: McpTool[];
}

interface ServerDraft {
  name: string;
  type: "stdio" | "http";
  command: string;
  argsText: string;
  url: string;
  headersText: string;
}

const GLASS_CARD = "glass-card border border-white/[0.07] rounded-2xl";
const INPUT_CLASS =
  "bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30";
const SECTION_HEADER = "text-[13px] font-mono text-zinc-700 uppercase tracking-wider";
const MODAL_BACKDROP = {
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
} as const;

const EMPTY_DRAFT: ServerDraft = {
  name: "",
  type: "stdio",
  command: "",
  argsText: "",
  url: "",
  headersText: "",
};

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

function normalizeServer(server: Record<string, unknown>): McpServer {
  const rawTools = Array.isArray(server.tools) ? server.tools : [];
  const tools = rawTools
    .map((tool) => {
      if (typeof tool === "string") {
        return { name: tool, description: "", enabled: true };
      }
      if (tool && typeof tool === "object") {
        return {
          name: String((tool as { name?: unknown }).name ?? "unknown"),
          description: String((tool as { description?: unknown }).description ?? ""),
          enabled: (tool as { enabled?: unknown }).enabled !== false && (tool as { enabled?: unknown }).enabled !== 0,
        };
      }
      return null;
    })
    .filter((tool): tool is McpTool => !!tool);

  const rawHeaders = server.headers;
  const headers =
    rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)
      ? Object.fromEntries(
          Object.entries(rawHeaders as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
        )
      : undefined;

  return {
    id: String(server.id ?? server.name ?? uuid()),
    name: String(server.name ?? "Unnamed server"),
    type: server.type === "http" ? "http" : "stdio",
    enabled: server.enabled !== false && server.enabled !== 0,
    command: typeof server.command === "string" ? server.command : undefined,
    args: Array.isArray(server.args) ? server.args.map(String) : undefined,
    url: typeof server.url === "string" ? server.url : undefined,
    headers,
    tools,
  };
}

function parseHeaders(raw: string): Record<string, string> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return acc;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

export default function McpView() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<ServerDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<Record<string, unknown>[]>("/api/mcp");
      const normalized = data.map(normalizeServer);
      setServers(normalized);
      setExpandedId((current) => current ?? normalized[0]?.id ?? null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load MCP servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const closeModal = () => {
    setDraft(EMPTY_DRAFT);
    setShowModal(false);
  };

  const saveServer = async () => {
    if (!draft.name.trim()) {
      setError("Server name is required.");
      return;
    }
    if (draft.type === "stdio" && !draft.command.trim()) {
      setError("A stdio server requires a command.");
      return;
    }
    if (draft.type === "http" && !draft.url.trim()) {
      setError("An http server requires a URL.");
      return;
    }

    setBusyKey("save");
    try {
      await requestJson("/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name.trim(),
          type: draft.type,
          ...(draft.type === "stdio"
            ? {
                command: draft.command.trim(),
                args: draft.argsText.trim() ? draft.argsText.trim().split(/\s+/) : [],
              }
            : {
                url: draft.url.trim(),
                headers: parseHeaders(draft.headersText),
              }),
        }),
      });
      closeModal();
      await loadServers();
      notifySuccess("Server added");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save MCP server";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  const toggleServer = async (server: McpServer) => {
    const enabled = !server.enabled;
    setBusyKey(`toggle:${server.id}`);
    try {
      try {
        await requestJson(`/api/mcp/${encodeURIComponent(server.name)}/toggle`, {
          method: "PATCH",
          body: JSON.stringify({ enabled }),
        });
      } catch {
        await requestJson(`/api/mcp/${encodeURIComponent(server.id)}`, {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        });
      }
      setServers((current) => current.map((item) => (item.id === server.id ? { ...item, enabled } : item)));
      setError("");
      notifySuccess(enabled ? "Server enabled" : "Server disabled");
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Failed to update server";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  const toggleTool = async (server: McpServer, tool: McpTool) => {
    const enabled = !tool.enabled;
    setBusyKey(`tool:${server.id}:${tool.name}`);
    try {
      await requestJson(`/api/mcp/${encodeURIComponent(server.name)}/tools/${encodeURIComponent(tool.name)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setServers((current) =>
        current.map((item) =>
          item.id !== server.id
            ? item
            : {
                ...item,
                tools: item.tools.map((entry) => (entry.name === tool.name ? { ...entry, enabled } : entry)),
              },
        ),
      );
      setError("");
      notifySuccess(enabled ? "Tool enabled" : "Tool disabled");
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Failed to update the selected MCP tool";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  const removeServer = async (server: McpServer) => {
    setBusyKey(`remove:${server.id}`);
    try {
      try {
        await requestJson(`/api/mcp/${encodeURIComponent(server.name)}`, { method: "DELETE" });
      } catch {
        await requestJson(`/api/mcp/${encodeURIComponent(server.id)}`, { method: "DELETE" });
      }
      setServers((current) => current.filter((item) => item.id !== server.id));
      if (expandedId === server.id) {
        setExpandedId(null);
      }
      setError("");
      notifySuccess("Server removed");
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : "Failed to remove server";
      setError(message);
      notifyError(message);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-none text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            MCP Servers
          </h1>
          <p className="mt-2 text-[14px] font-mono text-zinc-600">{servers.length} configured servers</p>
        </div>
        <PrimaryBtn onClick={() => setShowModal(true)} className="px-3 py-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Server
        </PrimaryBtn>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-[14px] font-mono text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className={`${GLASS_CARD} px-4 py-5 text-[14px] font-mono text-zinc-600`}>Loading MCP servers…</div>
        ) : servers.length === 0 ? (
          <div className={`${GLASS_CARD} px-4 py-5 text-[14px] font-mono text-zinc-700`}>
            No MCP servers configured.
          </div>
        ) : (
          servers.map((server) => {
            const expanded = expandedId === server.id;
            const statusText = server.enabled ? "enabled" : "disabled";
            return (
              <div key={server.id} className={`${GLASS_CARD} overflow-hidden`}>
                <div className="flex flex-wrap items-start gap-3 px-4 py-4">
                  <button
                    onClick={() => setExpandedId(expanded ? null : server.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[#66FCF1]/15"
                      style={{ background: "rgba(102,252,241,0.08)" }}
                    >
                      <Server className="h-4 w-4 text-[#66FCF1]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm text-zinc-100">{server.name}</span>
                        <Chip variant={server.type === "http" ? "info" : "muted"}>{server.type}</Chip>
                        <span className="flex items-center gap-1.5 text-[14px] font-mono text-zinc-500">
                          <StatusDot status={server.enabled ? "connected" : "disconnected"} />
                          {statusText}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[14px] font-mono text-zinc-600">
                        {server.type === "stdio"
                          ? [server.command, ...(server.args ?? [])].filter(Boolean).join(" ") ||
                            "No command configured"
                          : server.url || "No URL configured"}
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronDown className="mt-1 h-4 w-4 text-zinc-600" />
                    ) : (
                      <ChevronRight className="mt-1 h-4 w-4 text-zinc-600" />
                    )}
                  </button>

                  <div className="ml-auto flex items-center gap-3">
                    <Toggle checked={server.enabled} onChange={() => void toggleServer(server)} />
                    <DangerBtn onClick={() => void removeServer(server)} className="px-3 py-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyKey === `remove:${server.id}` ? "Removing…" : "Remove"}
                    </DangerBtn>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-white/[0.06] px-4 py-4">
                    <div className={SECTION_HEADER}>Tools</div>
                    <div className="mt-3 space-y-2">
                      {server.tools.length === 0 ? (
                        <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-3 text-[14px] font-mono text-zinc-700">
                          No tools reported by this server yet.
                        </div>
                      ) : (
                        server.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-mono text-zinc-200">{tool.name}</div>
                              <div className="mt-1 text-[13px] text-zinc-600">
                                {tool.description || "No description provided."}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Chip variant={tool.enabled ? "success" : "muted"}>
                                {tool.enabled ? "enabled" : "disabled"}
                              </Chip>
                              <Toggle checked={tool.enabled} onChange={() => void toggleTool(server, tool)} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={MODAL_BACKDROP}>
          <div className="glass-card border border-white/[0.09] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl leading-none text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  Add Server
                </h2>
                <p className="mt-2 text-[14px] font-mono text-zinc-600">Connect a new MCP stdio or HTTP endpoint.</p>
              </div>
              <SecondaryBtn onClick={closeModal} className="px-3 py-1.5">
                Close
              </SecondaryBtn>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <div className={SECTION_HEADER}>Name</div>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="my-server"
                  className={`mt-2 w-full ${INPUT_CLASS}`}
                />
              </div>

              <div>
                <div className={SECTION_HEADER}>Type</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["stdio", "http"] as const).map((type) => {
                    const active = draft.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setDraft((current) => ({ ...current, type }))}
                        className={`rounded-xl border px-3 py-2 text-left text-[14px] font-mono transition-colors ${
                          active
                            ? "border-[#66FCF1]/30 text-[#66FCF1]"
                            : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                        }`}
                        style={active ? { background: "rgba(102,252,241,0.08)" } : undefined}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {draft.type === "stdio" ? (
                <>
                  <div>
                    <div className={SECTION_HEADER}>Command</div>
                    <input
                      value={draft.command}
                      onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
                      placeholder="npx"
                      className={`mt-2 w-full ${INPUT_CLASS}`}
                    />
                  </div>
                  <div>
                    <div className={SECTION_HEADER}>Args</div>
                    <input
                      value={draft.argsText}
                      onChange={(event) => setDraft((current) => ({ ...current, argsText: event.target.value }))}
                      placeholder="-y @modelcontextprotocol/server-filesystem ."
                      className={`mt-2 w-full ${INPUT_CLASS}`}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className={SECTION_HEADER}>URL</div>
                    <input
                      value={draft.url}
                      onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                      placeholder="https://example.com/mcp"
                      className={`mt-2 w-full ${INPUT_CLASS}`}
                    />
                  </div>
                  <div>
                    <div className={SECTION_HEADER}>Headers</div>
                    <textarea
                      value={draft.headersText}
                      onChange={(event) => setDraft((current) => ({ ...current, headersText: event.target.value }))}
                      placeholder={"Authorization: Bearer ...\nX-Env: staging"}
                      className={`mt-2 min-h-[120px] w-full resize-y ${INPUT_CLASS}`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <SecondaryBtn onClick={closeModal} className="px-3 py-1.5">
                Cancel
              </SecondaryBtn>
              <PrimaryBtn onClick={() => void saveServer()} className="px-3 py-1.5">
                {busyKey === "save" ? "Saving…" : "Save"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
