import { CheckCheck, Clock3, Inbox, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, DangerBtn, IoMark, MarkdownRenderer, SecondaryBtn, SquadChip } from "@/components/ui";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

interface FeedItem {
  id: string;
  source: string;
  title: string;
  content: string;
  read: number;
  created_at: string;
}

interface FeedResponse {
  items: FeedItem[];
  unreadCount: number;
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

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(path, init);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function previewText(content: string): string {
  return content
    .replace(/[`#>*_~-]/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedView() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"read" | "delete" | null>(null);

  const loadFeed = useCallback(
    async (nextSelectedId?: string | null) => {
      setLoading(true);
      try {
        const data = await fetchJson<FeedResponse>(`/api/feed?unread=${filter === "unread"}`);
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        setCheckedIds((prev) => prev.filter((id) => data.items.some((item) => item.id === id)));
        setSelectedId((prev) => {
          const candidate = nextSelectedId === undefined ? prev : nextSelectedId;
          return candidate && data.items.some((item) => item.id === candidate) ? candidate : null;
        });
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const selectedItem = useMemo(
    () => (checkedIds.length === 0 ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [checkedIds.length, items, selectedId],
  );
  const allSelected = items.length > 0 && checkedIds.length === items.length;

  const markRead = async (id: string) => {
    await fetchJson<{ ok: true }>(`/api/feed/${id}/read`, { method: "POST" });
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: 1 } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleSelectItem = async (item: FeedItem) => {
    setSelectedId(item.id);
    if (item.read === 0) {
      await markRead(item.id);
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const handleMarkCheckedRead = async () => {
    if (checkedIds.length === 0 || busyAction) return;
    setBusyAction("read");
    try {
      await Promise.all(checkedIds.map((id) => fetchJson<{ ok: true }>(`/api/feed/${id}/read`, { method: "POST" })));
      setCheckedIds([]);
      await loadFeed(selectedId);
      notifySuccess(checkedIds.length === 1 ? "Feed item marked read" : "Feed items marked read");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to mark feed items read");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0 || busyAction) return;
    setBusyAction("delete");
    try {
      await Promise.all(ids.map((id) => fetchJson<{ ok: true }>(`/api/feed/${id}`, { method: "DELETE" })));
      setCheckedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await loadFeed(selectedId && ids.includes(selectedId) ? null : selectedId);
      notifySuccess(ids.length === 1 ? "Feed item deleted" : "Feed items deleted");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to delete feed items");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 p-5">
      <div className="flex flex-1 min-h-0 gap-5">
        <aside className="glass-card border border-white/[0.07] rounded-2xl w-72 min-h-0 flex flex-col overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-mono uppercase tracking-[0.28em] text-zinc-500">Feed</p>
                <h1 className="text-3xl text-zinc-100 leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  Inbox
                </h1>
              </div>
              <Chip variant={unreadCount > 0 ? "default" : "muted"}>{unreadCount} unread</Chip>
            </div>

            <div className="flex gap-2 rounded-xl border border-white/[0.06] bg-black/10 p-1 font-mono text-[14px]">
              {(["all", "unread"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`flex-1 rounded-lg px-3 py-2 uppercase tracking-wide transition-colors ${filter === tab ? "bg-[#66FCF1]/10 text-[#66FCF1]" : "text-zinc-500 hover:text-zinc-200"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-[14px] font-mono text-zinc-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setCheckedIds(allSelected ? [] : items.map((item) => item.id))}
                  className="h-3.5 w-3.5 rounded border-white/10 bg-transparent accent-[#66FCF1]"
                />
                Select all
              </label>
              <span>{checkedIds.length} checked</span>
            </div>

            {checkedIds.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[#66FCF1]/15 bg-[#66FCF1]/5 p-2">
                <SecondaryBtn
                  onClick={() => void handleMarkCheckedRead()}
                  className={busyAction ? "pointer-events-none opacity-50" : ""}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </SecondaryBtn>
                <DangerBtn
                  onClick={() => void handleDelete(checkedIds)}
                  className={busyAction ? "pointer-events-none opacity-50" : ""}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DangerBtn>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[14px] font-mono text-zinc-500">
                Loading inbox…
              </div>
            ) : items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <IoMark height={26} />
                <div>
                  <p className="text-zinc-200">No feed items</p>
                  <p className="text-[14px] font-mono text-zinc-500">
                    {filter === "unread"
                      ? "Everything has been reviewed."
                      : "The daemon has not posted any updates yet."}
                  </p>
                </div>
              </div>
            ) : (
              items.map((item) => {
                const checked = checkedIds.includes(item.id);
                const selected = selectedId === item.id && checkedIds.length === 0;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border border-white/[0.06] border-l-4 p-3 transition-colors ${selected ? "bg-[#66FCF1]/5 border-l-[#66FCF1]" : "bg-black/10 border-l-transparent hover:bg-white/[0.03]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChecked(item.id)}
                        className="mt-1 h-3.5 w-3.5 rounded border-white/10 bg-transparent accent-[#66FCF1]"
                      />
                      <button onClick={() => void handleSelectItem(item)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.read === 0 ? (
                              <span className="h-2 w-2 rounded-full bg-[#F75F57] flex-shrink-0" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-transparent border border-white/10 flex-shrink-0" />
                            )}
                            <SquadChip name={item.source} />
                          </div>
                          <span className="text-[14px] font-mono text-zinc-500 flex items-center gap-1 flex-shrink-0">
                            <Clock3 className="h-3 w-3" />
                            {formatTimestamp(item.created_at)}
                          </span>
                        </div>
                        <p
                          className={`text-sm leading-5 truncate ${item.read === 0 ? "text-zinc-100" : "text-zinc-300"}`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-1 text-[14px] font-mono text-zinc-500 line-clamp-2">
                          {previewText(item.content)}
                        </p>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex-1 min-h-0">
          {checkedIds.length > 0 ? (
            <div className="glass-card border border-white/[0.07] rounded-2xl h-full flex items-center justify-center p-8 text-center">
              <div className="max-w-md space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#66FCF1]/20 bg-[#66FCF1]/8 text-[#66FCF1]">
                  <CheckCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-zinc-100 text-lg">Bulk mode enabled</p>
                  <p className="text-[14px] font-mono text-zinc-500 mt-2">
                    {checkedIds.length} feed item{checkedIds.length === 1 ? "" : "s"} selected. Use the bulk controls to
                    mark everything read or delete in one pass.
                  </p>
                </div>
              </div>
            </div>
          ) : selectedItem ? (
            <article className="glass-card border border-white/[0.07] rounded-2xl h-full min-h-0 flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <SquadChip name={selectedItem.source} />
                    <span className="text-[14px] font-mono text-zinc-500">
                      {formatTimestamp(selectedItem.created_at)}
                    </span>
                  </div>
                  <h2 className="text-2xl text-zinc-100 leading-tight">{selectedItem.title}</h2>
                </div>
                <DangerBtn
                  onClick={() => void handleDelete([selectedItem.id])}
                  className={busyAction ? "pointer-events-none opacity-50" : ""}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DangerBtn>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 text-zinc-200">
                <MarkdownRenderer content={selectedItem.content} className="max-w-none" />
              </div>
            </article>
          ) : (
            <div className="glass-card border border-white/[0.07] rounded-2xl h-full flex items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/10 text-[#66FCF1]">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-zinc-100 text-lg">Select a message to read</p>
                  <p className="text-[14px] font-mono text-zinc-500 mt-2">
                    Choose any feed item from the left panel to open the full markdown update here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
