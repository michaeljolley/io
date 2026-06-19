import { Pencil, Search, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, DangerBtn, MarkdownRenderer, PrimaryBtn, SecondaryBtn } from "@/components/ui";
import { notifyError, notifySuccess } from "@/lib/notify";
import { type ParsedSkill, parseSkillContent } from "@/lib/skill-frontmatter";
import { useAuthStore } from "@/stores/auth";

type SkillSource = "installed" | "awesome-copilot" | "skillssh";

interface InstalledSkill {
  name: string;
  slug: string;
  description: string;
  path: string;
}

interface RemoteSkill {
  slug: string;
  name: string;
  description: string;
  source: Exclude<SkillSource, "installed">;
  sourceRepo?: string;
  installs?: number;
}

interface SkillDetailState {
  content?: string;
  parsed?: ParsedSkill;
  loading?: boolean;
  error?: string;
}

interface SelectedSkill {
  source: SkillSource;
  slug: string;
}

const SECTION_HEADER = "text-[13px] font-mono text-zinc-700 uppercase tracking-wider";

function skillKey(source: SkillSource, slug: string): string {
  return `${source}:${slug}`;
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

function frontmatterLabel(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function frontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export default function SkillsView() {
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [remoteSkills, setRemoteSkills] = useState<RemoteSkill[]>([]);
  const [source, setSource] = useState<SkillSource>("installed");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedSkill | null>(null);
  const [detailState, setDetailState] = useState<Record<string, SkillDetailState>>({});
  const [loadingInstalled, setLoadingInstalled] = useState(true);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [pageError, setPageError] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const loadInstalledSkills = useCallback(async () => {
    setLoadingInstalled(true);
    try {
      const data = await requestJson<InstalledSkill[]>("/api/skills");
      setInstalledSkills(data);
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load skills");
    } finally {
      setLoadingInstalled(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalledSkills();
  }, [loadInstalledSkills]);

  useEffect(() => {
    if (source === "installed") return;

    const timeout = window.setTimeout(async () => {
      setLoadingRemote(true);
      try {
        const query = new URLSearchParams({ source });
        if (search.trim()) {
          query.set("q", search.trim());
        }
        const data = await requestJson<RemoteSkill[]>(`/api/skills/discover?${query.toString()}`);
        setRemoteSkills(data);
        setPageError("");
      } catch (error) {
        setRemoteSkills([]);
        setPageError(error instanceof Error ? error.message : "Failed to search remote skills");
      } finally {
        setLoadingRemote(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [search, source]);

  const installedLookup = useMemo(() => {
    const map = new Map<string, InstalledSkill>();
    for (const skill of installedSkills) {
      map.set(skill.slug, skill);
    }
    return map;
  }, [installedSkills]);

  const visibleSkills = useMemo(() => {
    if (source === "installed") {
      const query = search.trim().toLowerCase();
      if (!query) return installedSkills;
      return installedSkills.filter((skill) =>
        [skill.name, skill.slug, skill.description].some((value) => value?.toLowerCase().includes(query)),
      );
    }
    return remoteSkills;
  }, [installedSkills, remoteSkills, search, source]);

  useEffect(() => {
    if (visibleSkills.length === 0) {
      if (selected?.source === source) {
        setSelected(null);
      }
      return;
    }

    const currentVisible =
      selected && selected.source === source && visibleSkills.some((skill) => skill.slug === selected.slug);

    if (!currentVisible) {
      setSelected({ source, slug: visibleSkills[0].slug });
      setEditMode(false);
    }
  }, [selected, source, visibleSkills]);

  const selectedSkill = useMemo(() => {
    if (!selected) return null;
    if (selected.source === "installed") {
      return installedSkills.find((skill) => skill.slug === selected.slug) ?? null;
    }
    return remoteSkills.find((skill) => skill.slug === selected.slug) ?? null;
  }, [installedSkills, remoteSkills, selected]);

  useEffect(() => {
    if (!selectedSkill || !selected) return;

    const key = skillKey(selected.source, selected.slug);
    const cached = detailState[key];
    if (cached?.loading || cached?.content || cached?.error) return;

    setDetailState((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: "" },
    }));

    const loadSkillDetail = async () => {
      try {
        const content =
          selected.source === "installed"
            ? (await requestJson<{ content: string }>(`/api/skills/${encodeURIComponent(selected.slug)}/content`))
                .content
            : (
                await requestJson<{ content: string }>(
                  `/api/skills/preview?${new URLSearchParams({
                    source: selected.source,
                    slug: selected.slug,
                    ...("sourceRepo" in selectedSkill && selectedSkill.sourceRepo
                      ? { sourceRepo: selectedSkill.sourceRepo }
                      : {}),
                  }).toString()}`,
                )
              ).content;

        setDetailState((current) => ({
          ...current,
          [key]: { content, parsed: parseSkillContent(content), loading: false, error: "" },
        }));
      } catch (error) {
        setDetailState((current) => ({
          ...current,
          [key]: {
            ...current[key],
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load skill details",
          },
        }));
      }
    };

    void loadSkillDetail();
  }, [detailState, selected, selectedSkill]);

  const selectedKey = selected ? skillKey(selected.source, selected.slug) : "";
  const selectedDetail = selected ? detailState[selectedKey] : undefined;
  const selectedFrontmatter = selectedDetail?.parsed?.frontmatter ?? {};
  const selectedBody = selectedDetail?.parsed?.body ?? "";
  const isInstalled = !!(selectedSkill && installedLookup.has(selectedSkill.slug));

  const getListMeta = (skill: InstalledSkill | RemoteSkill): string => {
    const key = skillKey(source, skill.slug);
    const detail = detailState[key];
    const installs =
      source === "skillssh" && "installs" in skill && skill.installs
        ? `${skill.installs.toLocaleString()} installs`
        : undefined;
    const author =
      typeof detail?.parsed?.frontmatter.author === "string"
        ? detail.parsed.frontmatter.author
        : "sourceRepo" in skill && skill.sourceRepo
          ? skill.sourceRepo
          : source === "awesome-copilot"
            ? "awesome-copilot"
            : "community";
    return `${author}${installs ? ` · ${installs}` : ""}`;
  };

  const startEditing = () => {
    if (!selectedDetail?.content || !selected || selected.source !== "installed") return;
    setEditContent(selectedDetail.content);
    setEditMode(true);
  };

  const saveEditedContent = async () => {
    if (selected?.source !== "installed") return;

    const key = skillKey(selected.source, selected.slug);
    setActionKey(`save:${key}`);
    try {
      await requestJson(`/api/skills/${encodeURIComponent(selected.slug)}/content`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setDetailState((current) => ({
        ...current,
        [key]: { content: editContent, parsed: parseSkillContent(editContent), loading: false, error: "" },
      }));
      setEditMode(false);
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save skill");
    } finally {
      setActionKey("");
    }
  };

  const removeInstalledSkill = async () => {
    if (!selectedSkill || !selected || selected.source !== "installed") return;

    setActionKey(`remove:${selected.slug}`);
    try {
      await requestJson(`/api/skills/${encodeURIComponent(selected.slug)}`, { method: "DELETE" });
      setInstalledSkills((current) => current.filter((skill) => skill.slug !== selected.slug));
      setDetailState((current) => {
        const next = { ...current };
        delete next[skillKey("installed", selected.slug)];
        return next;
      });
      setPageError("");
      notifySuccess("Skill removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove skill";
      setPageError(message);
      notifyError(message);
    } finally {
      setActionKey("");
      setEditMode(false);
    }
  };

  const installRemoteSkill = async () => {
    if (!selectedSkill || !selected || selected.source === "installed" || isInstalled) return;

    setActionKey(`install:${selected.slug}`);
    try {
      await requestJson("/api/skills", {
        method: "POST",
        body: JSON.stringify({
          source: selected.source,
          slug: selected.slug,
          ...("sourceRepo" in selectedSkill && selectedSkill.sourceRepo
            ? { sourceRepo: selectedSkill.sourceRepo }
            : {}),
        }),
      });
      await loadInstalledSkills();
      setPageError("");
      notifySuccess("Skill installed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to install skill";
      setPageError(message);
      notifyError(message);
    } finally {
      setActionKey("");
    }
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="grid h-full min-h-0 grid-cols-[16rem_minmax(0,1fr)]">
        <aside className={`min-h-0 overflow-hidden flex flex-col border-r border-white/[0.06]`}>
          <div className="border-b border-white/[0.06] p-3">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-700" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills..."
                className={`w-full pl-9 bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30`}
              />
            </div>

            <div className="space-y-1">
              {(
                [
                  ["installed", "Installed"],
                  ["awesome-copilot", "Awesome Copilot"],
                  ["skillssh", "skills.sh"],
                ] as const
              ).map(([tabKey, label]) => {
                const active = source === tabKey;
                return (
                  <button
                    key={tabKey}
                    onClick={() => setSource(tabKey)}
                    className={`w-full text-left cursor-pointer px-2.5 py-1.5 rounded-lg text-[14px] font-mono transition-colors ${
                      active ? "text-[#66FCF1]" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                    }`}
                    style={active ? { background: "rgba(102,252,241,0.10)" } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {pageError && (
              <div className="border-b border-red-500/15 bg-red-500/6 px-3 py-2 text-[14px] font-mono text-red-300">
                {pageError}
              </div>
            )}

            {(loadingInstalled || loadingRemote) && visibleSkills.length === 0 ? (
              <div className="px-4 py-5 text-[14px] font-mono text-zinc-600">Loading skills…</div>
            ) : visibleSkills.length === 0 ? (
              <div className="px-4 py-5 text-[14px] font-mono text-zinc-700">No skills found.</div>
            ) : (
              visibleSkills.map((skill) => {
                const active = selected?.source === source && selected.slug === skill.slug;
                return (
                  <button
                    key={`${source}:${skill.slug}`}
                    onClick={() => {
                      setSelected({ source, slug: skill.slug });
                      setEditMode(false);
                    }}
                    className={`w-full cursor-pointer border-l-2 px-3 py-3 text-left transition-colors ${
                      active ? "border-[#66FCF1]" : "border-transparent hover:bg-white/[0.03]"
                    }`}
                    style={active ? { background: "var(--base-dark-teal)" } : undefined}
                  >
                    <div className="truncate text-[14px] font-mono text-zinc-200">{skill.name || skill.slug}</div>
                    <div
                      className="mt-1 text-[13px] leading-relaxed text-zinc-600 line-clamp-2"
                      style={active ? { color: "var(--base-gray)" } : undefined}
                    >
                      {skill.description
                        ? skill.description.length > 100
                          ? `${skill.description.slice(0, 100)}…`
                          : skill.description
                        : "No description"}
                    </div>
                    <div
                      className="mt-2 truncate text-[11px] font-mono text-zinc-700"
                      style={active ? { color: "var(--base-gray)" } : undefined}
                    >
                      {getListMeta(skill)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`min-h-0 overflow-hidden flex flex-col`}>
          {!selectedSkill ? (
            <div className="flex h-full items-center justify-center align-center px-6 text-center">
              <div>
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#66FCF1]/20"
                  style={{ background: "rgba(102,252,241,0.10)" }}
                >
                  <Zap className="h-6 w-6 text-[#66FCF1]" />
                </div>
                <p className="mt-4 text-sm text-zinc-400">
                  Select a skill to inspect its front matter and prompt body.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col ">
              <div className="border-b border-white/[0.06] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-4 items-center">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-[#66FCF1]/20"
                      style={{ background: "rgba(102,252,241,0.10)" }}
                    >
                      <Zap className="h-5 w-5 text-[#66FCF1]" />
                    </div>
                    <div className="flex justify-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1
                          className="text-3xl leading-none text-white"
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                        >
                          {selectedDetail?.parsed?.frontmatter.name || selectedSkill.name || selectedSkill.slug}
                        </h1>
                        {typeof selectedFrontmatter.version === "string" ? (
                          <Chip variant="info">v{selectedFrontmatter.version}</Chip>
                        ) : (
                          <Chip variant="muted">unversioned</Chip>
                        )}
                        <Chip variant={isInstalled ? "success" : "muted"}>{isInstalled ? "installed" : "remote"}</Chip>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selected?.source === "installed" ? (
                      <>
                        <SecondaryBtn onClick={startEditing} className="px-3 py-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </SecondaryBtn>
                        <DangerBtn onClick={() => void removeInstalledSkill()} className="px-3 py-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          {actionKey === `remove:${selected?.slug}` ? "Removing…" : "Remove"}
                        </DangerBtn>
                      </>
                    ) : (
                      <PrimaryBtn
                        onClick={isInstalled ? undefined : () => void installRemoteSkill()}
                        className="px-3 py-1.5"
                      >
                        {actionKey === `install:${selected?.slug}`
                          ? "Installing…"
                          : isInstalled
                            ? "Installed"
                            : "Install"}
                      </PrimaryBtn>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                {selectedDetail?.loading ? (
                  <div className="text-[14px] font-mono text-zinc-600">Loading skill detail…</div>
                ) : selectedDetail?.error ? (
                  <div className="rounded-2xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-[14px] font-mono text-red-300">
                    {selectedDetail.error}
                  </div>
                ) : editMode ? (
                  <div className={`p-5 space-y-4`}>
                    <div className={SECTION_HEADER}>Editing skill markdown</div>
                    <textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      className="min-h-[440px] w-full resize-y rounded-2xl border border-white/[0.06] bg-[#181818] px-4 py-3 font-mono text-[14px] text-zinc-300 placeholder:text-zinc-700 focus:border-[#66FCF1]/30 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryBtn onClick={() => void saveEditedContent()} className="px-3 py-1.5">
                        {actionKey === `save:${selectedKey}` ? "Saving…" : "Save"}
                      </PrimaryBtn>
                      <SecondaryBtn onClick={() => setEditMode(false)} className="px-3 py-1.5">
                        Cancel
                      </SecondaryBtn>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`p-2`}>
                      <div className={SECTION_HEADER}>Front Matter</div>
                      {Object.entries(selectedFrontmatter).filter(
                        ([k, v]) =>
                          k !== "name" &&
                          k !== "description" &&
                          v != null &&
                          v !== "" &&
                          !(Array.isArray(v) && v.length === 0),
                      ).length === 0 ? (
                        <div className="mt-4 text-[14px] font-mono text-zinc-700">No front matter metadata found.</div>
                      ) : (
                        <div className="mt-4 space-y-0">
                          {Object.entries(selectedFrontmatter)
                            .filter(
                              ([key, value]) =>
                                key !== "name" &&
                                value != null &&
                                value !== "" &&
                                !(Array.isArray(value) && value.length === 0),
                            )
                            .map(([key, value]) => (
                              <div
                                key={key}
                                className="grid grid-cols-[200px_1fr] gap-2 border-b border-white/[0.04] py-3 first:pt-0 last:border-b-0 last:pb-0"
                              >
                                <span className="text-[14px] font-mono text-zinc-500">{frontmatterLabel(key)}</span>
                                <span className="text-[14px] font-mono text-zinc-300 break-words min-w-0 text-left">
                                  {frontmatterValue(value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className={`p-5`}>
                      <div className={SECTION_HEADER}>Body</div>
                      {selectedBody ? (
                        <MarkdownRenderer content={selectedBody} className="mt-4" />
                      ) : (
                        <div className="mt-4 text-[14px] font-mono text-zinc-700">This skill has no markdown body.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
