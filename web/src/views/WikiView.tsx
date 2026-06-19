import { ChevronDown, ChevronRight, FileText, Folder, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DangerBtn, IoMark, MarkdownRenderer, PrimaryBtn, SecondaryBtn } from "@/components/ui";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

interface WikiReadResponse {
  path?: string;
  content?: string;
}

interface SearchResult {
  path?: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: TreeNode[];
}

const treeItemClass = "px-3 py-1.5 text-[14px] font-mono hover:bg-white/[0.04] rounded-lg cursor-pointer";

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function authJson<T>(paths: string[], init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;

  for (let index = 0; index < paths.length; index += 1) {
    const res = await fetch(paths[index], {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (res.ok) {
      if (res.status === 204) {
        return undefined as T;
      }
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

function normalizePaths(items: unknown): string[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "path" in item && typeof item.path === "string") return item.path;
      return null;
    })
    .filter((value): value is string => !!value)
    .sort((a, b) => a.localeCompare(b));
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const fullPath of paths) {
    const segments = fullPath.split("/").filter(Boolean);
    let level = root;

    segments.forEach((segment, index) => {
      const currentPath = segments.slice(0, index + 1).join("/");
      const isFile = index === segments.length - 1;
      let node = level.find((entry) => entry.path === currentPath);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        level.push(node);
      }

      if (!isFile) {
        node.children ??= [];
        level = node.children;
      }
    });
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
}

function defaultExpanded(paths: string[]) {
  return paths.reduce<Record<string, boolean>>((acc, path) => {
    const segments = path.split("/").slice(0, -1);
    segments.forEach((_, index) => {
      acc[segments.slice(0, index + 1).join("/")] = true;
    });
    return acc;
  }, {});
}

function Breadcrumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[14px] font-mono text-zinc-500">
      {parts.map((part, index) => (
        <div key={parts.slice(0, index + 1).join("/")} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-zinc-700">/</span>}
          <span className={index === parts.length - 1 ? "text-[#66FCF1]" : "text-zinc-400"}>{part}</span>
        </div>
      ))}
    </div>
  );
}

function TreeBranch({
  nodes,
  selectedPath,
  expanded,
  onToggle,
  onSelect,
  onCreateInFolder,
  onDeleteFolder,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onCreateInFolder: (folderPath: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  depth?: number;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        const isFolder = node.type === "folder";
        const isOpen = expanded[node.path] ?? depth < 1;
        const isActive = node.path === selectedPath;

        return (
          <div key={node.path}>
            <div className="group relative">
              <button
                type="button"
                onClick={() => (isFolder ? onToggle(node.path) : onSelect(node.path))}
                className={`${treeItemClass} w-full flex items-center gap-2 text-left ${
                  isActive ? "text-[#66FCF1] bg-[#66FCF1]/5" : "text-zinc-400"
                }`}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
              >
                {isFolder ? (
                  <>
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3 text-zinc-600" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-zinc-600" />
                    )}
                    <Folder className={`h-3.5 w-3.5 ${isActive ? "text-[#66FCF1]" : "text-[#45A29E]"}`} />
                  </>
                ) : (
                  <>
                    <span className="h-3 w-3" />
                    <FileText className={`h-3.5 w-3.5 ${isActive ? "text-[#66FCF1]" : "text-zinc-500"}`} />
                  </>
                )}
                <span className="truncate">{node.name}</span>
              </button>
              {isFolder && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateInFolder(node.path);
                    }}
                    className="rounded p-0.5 text-zinc-600 hover:text-[#66FCF1] cursor-pointer"
                    title="New page in folder"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(node.path);
                    }}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400 cursor-pointer"
                    title="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {isFolder && isOpen && node.children?.length ? (
              <TreeBranch
                nodes={node.children}
                selectedPath={selectedPath}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                onCreateInFolder={onCreateInFolder}
                onDeleteFolder={onDeleteFolder}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function WikiView() {
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPagePath, setNewPagePath] = useState("");

  const loadPages = useCallback(async () => {
    const response = await authJson<unknown>(["/api/wiki/pages"]);
    const nextPages = normalizePaths(response);
    setPages(nextPages);
    setExpanded((current) => ({ ...defaultExpanded(nextPages), ...current }));
  }, []);

  const loadPage = async (path: string) => {
    setBusy(true);
    try {
      const response = await authJson<WikiReadResponse>([
        `/api/wiki/pages/${encodePath(path)}`,
        `/api/wiki/page/${encodePath(path)}`,
      ]);
      setSelectedPath(path);
      setContent(response.content ?? "");
      setDraft(response.content ?? "");
      setEditing(false);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load page");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadPages();
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to load wiki pages");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPages]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await authJson<SearchResult[] | string[]>([
            `/api/wiki/search?q=${encodeURIComponent(search.trim())}`,
          ]);
          setSearchResults(normalizePaths(response));
        } catch {
          setSearchResults(pages.filter((path) => path.toLowerCase().includes(search.trim().toLowerCase())));
        }
      })();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [pages, search]);

  const visiblePaths = searchResults ?? pages;
  const tree = useMemo(() => buildTree(visiblePaths), [visiblePaths]);

  const savePage = async () => {
    if (!selectedPath) return;

    setBusy(true);
    try {
      await authJson([`/api/wiki/pages/${encodePath(selectedPath)}`, `/api/wiki/page/${encodePath(selectedPath)}`], {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      });
      setContent(draft);
      setEditing(false);
      notifySuccess("Wiki page saved");
      await loadPages();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save page");
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async () => {
    if (!selectedPath) return;

    setBusy(true);
    try {
      await authJson([`/api/wiki/pages/${encodePath(selectedPath)}`, `/api/wiki/page/${encodePath(selectedPath)}`], {
        method: "DELETE",
      });
      const removed = selectedPath;
      setSelectedPath(null);
      setContent("");
      setDraft("");
      setEditing(false);
      await loadPages();
      notifySuccess(`Deleted ${removed}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to delete page");
    } finally {
      setBusy(false);
    }
  };

  const deleteFolder = async (folderPath: string) => {
    const folderPages = pages.filter((p) => p.startsWith(folderPath + "/"));
    if (!folderPages.length) return;

    setBusy(true);
    try {
      for (const pagePath of folderPages) {
        await authJson([`/api/wiki/pages/${encodePath(pagePath)}`, `/api/wiki/page/${encodePath(pagePath)}`], {
          method: "DELETE",
        });
      }
      if (selectedPath?.startsWith(folderPath + "/")) {
        setSelectedPath(null);
        setContent("");
        setDraft("");
        setEditing(false);
      }
      await loadPages();
      notifySuccess(`Deleted folder ${folderPath}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to delete folder");
    } finally {
      setBusy(false);
    }
  };

  const createInFolder = (folderPath: string) => {
    setNewPagePath(folderPath + "/");
    setNewPageOpen(true);
  };

  const createPage = async () => {
    const trimmedPath = newPagePath.trim();
    if (!trimmedPath) return;

    setBusy(true);
    try {
      const initialContent = `# ${trimmedPath.split("/").pop() ?? trimmedPath}\n\n`;
      await authJson([`/api/wiki/pages/${encodePath(trimmedPath)}`, `/api/wiki/page/${encodePath(trimmedPath)}`], {
        method: "PUT",
        body: JSON.stringify({ content: initialContent }),
      });
      setNewPageOpen(false);
      setNewPagePath("");
      await loadPages();
      setExpanded((current) => ({ ...current, ...defaultExpanded([trimmedPath]) }));
      await loadPage(trimmedPath);
      setEditing(true);
      setDraft(initialContent);
      setContent(initialContent);
      notifySuccess("New page created");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to create page");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[14px] font-mono text-zinc-500">Loading wiki…</div>;
  }

  return (
    <div className="flex flex-1 min-h-0  text-zinc-200">
      <aside className="w-64 border-r border-white/[0.06]  p-3 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-700" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search wiki"
            className={`bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30 w-full pl-9`}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] ">
            <button
              type="button"
              onClick={() => setNewPageOpen((current) => !current)}
              className="rounded-lg p-1 text-zinc-500 cursor-pointer border border-white/[0.06] justify-center rounded-xl p-2 w-full text-xs flex gap-1 transition-colors hover:bg-white/[0.04] hover:text-[#66FCF1]"
              title="New Page"
            >
              <Plus className="h-3.5 w-3.5" /> Add Page
            </button>
          </div>

          {newPageOpen ? (
            <div className="border-b border-white/[0.06] p-3 space-y-2">
              <input
                value={newPagePath}
                onChange={(event) => setNewPagePath(event.target.value)}
                placeholder="notes/roadmap.md"
                className={`bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[14px] text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/30 w-full pl-9 w-full`}
              />
              <div className="flex items-center gap-2">
                <PrimaryBtn
                  onClick={createPage}
                  className={`px-3 py-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </PrimaryBtn>
                <SecondaryBtn onClick={() => setNewPageOpen(false)} className="px-3 py-2">
                  <X className="h-3.5 w-3.5" />
                  Close
                </SecondaryBtn>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 overflow-y-auto p-2">
            {tree.length ? (
              <TreeBranch
                nodes={tree}
                selectedPath={selectedPath}
                expanded={expanded}
                onToggle={(path) => setExpanded((current) => ({ ...current, [path]: !(current[path] ?? true) }))}
                onSelect={(path) => void loadPage(path)}
                onCreateInFolder={createInFolder}
                onDeleteFolder={(path) => void deleteFolder(path)}
              />
            ) : (
              <div className="px-3 py-6 text-center text-[14px] font-mono text-zinc-600">No pages found</div>
            )}
          </div>
        </div>
      </aside>

      <section className="flex-1 min-w-0 p-6 overflow-hidden flex flex-col gap-4">
        <div className="p-2 flex items-center gap-3 justify-between">
          <div className="min-w-0 flex-1">
            {selectedPath ? (
              <Breadcrumbs path={selectedPath} />
            ) : (
              <p className="text-[14px] font-mono uppercase tracking-[0.24em] text-zinc-600">Wiki</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedPath ? (
              <>
                {editing ? (
                  <>
                    <PrimaryBtn
                      onClick={savePage}
                      className={`px-3 py-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </PrimaryBtn>
                    <SecondaryBtn
                      onClick={() => {
                        setDraft(content);
                        setEditing(false);
                      }}
                      className="px-3 py-2"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </SecondaryBtn>
                  </>
                ) : (
                  <SecondaryBtn
                    onClick={() => {
                      setDraft(content);
                      setEditing(true);
                    }}
                    className="px-3 py-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </SecondaryBtn>
                )}
                <DangerBtn onClick={deletePage} className={`px-3 py-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DangerBtn>
              </>
            ) : (
              <SecondaryBtn onClick={() => setNewPageOpen(true)} className="px-3 py-2">
                <Plus className="h-3.5 w-3.5" />
                New Page
              </SecondaryBtn>
            )}
          </div>
        </div>

        <div className="glass-card border border-white/[0.07] rounded-2xl flex-1 min-h-0 overflow-hidden">
          {selectedPath ? (
            editing ? (
              <div className="h-full p-4">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-full w-full resize-none rounded-2xl border border-white/[0.06] bg-[#121212] px-4 py-3 text-[15px] leading-6 text-zinc-300 font-mono focus:outline-none focus:border-[#66FCF1]/30"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto px-6 py-5">
                {busy ? (
                  <div className="text-[14px] font-mono text-zinc-500">Loading page…</div>
                ) : (
                  <MarkdownRenderer content={content} />
                )}
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <IoMark height={40} />
              </div>
              <h2 className="text-lg text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                Select a page
              </h2>
              <p className="mt-2 max-w-md text-[14px] font-mono text-zinc-600">
                Browse the file tree on the left, search for a page, or create a new markdown document.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
