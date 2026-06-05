import { configuredMarked as marked } from "@/components/ui/markdown";
import { DangerBtn, PrimaryBtn, SecondaryBtn } from "@/components/ui/shared";
import { api } from "@/lib/api";
import {
	BookOpen,
	ChevronRight,
	FileText,
	Folder,
	FolderOpen,
	Loader2,
	Pencil,
	Plus,
	Save,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface WikiPage {
	name: string;
	path: string;
	scope?: string;
	isDir?: boolean;
}

interface TreeNode {
	name: string;
	path: string;
	isDir: boolean;
	children: TreeNode[];
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
	return [...nodes]
		.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		})
		.map((node) => ({ ...node, children: sortTree(node.children) }));
}

function buildTree(pages: WikiPage[]): TreeNode[] {
	const root: TreeNode[] = [];

	for (const page of pages) {
		const segments = page.path.split("/").filter(Boolean);
		let currentLevel = root;
		let currentPath = "";

		// If this is a directory-only entry, ensure the directory path exists
		if (page.isDir) {
			for (const segment of segments) {
				currentPath = currentPath ? `${currentPath}/${segment}` : segment;
				let node = currentLevel.find((candidate) => candidate.path === currentPath);
				if (!node) {
					node = {
						name: segment,
						path: currentPath,
						isDir: true,
						children: [],
					};
					currentLevel.push(node);
				}
				currentLevel = node.children;
			}
			continue;
		}

		for (const [index, segment] of segments.entries()) {
			const isFile = index === segments.length - 1;
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;

			let node = currentLevel.find((candidate) => candidate.path === currentPath);
			if (!node) {
				node = {
					name: isFile ? page.name || segment : segment,
					path: currentPath,
					isDir: !isFile,
					children: [],
				};
				currentLevel.push(node);
			}

			currentLevel = node.children;
		}
	}

	return sortTree(root);
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
	if (!query) return nodes;

	return nodes.flatMap((node) => {
		const matches =
			node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);

		if (!node.isDir) {
			return matches ? [node] : [];
		}

		if (matches) {
			return [node];
		}

		const children = filterTree(node.children, query);
		return children.length ? [{ ...node, children }] : [];
	});
}

function collectDirectoryPaths(nodes: TreeNode[]): Set<string> {
	const paths = new Set<string>();

	for (const node of nodes) {
		if (!node.isDir) continue;
		paths.add(node.path);
		for (const childPath of collectDirectoryPaths(node.children)) {
			paths.add(childPath);
		}
	}

	return paths;
}

function getAncestorPaths(path: string): string[] {
	const segments = path.split("/").filter(Boolean);
	const ancestors: string[] = [];
	let currentPath = "";

	for (const segment of segments.slice(0, -1)) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;
		ancestors.push(currentPath);
	}

	return ancestors;
}

function TreeItem({
	node,
	depth,
	selectedPage,
	expandedPaths,
	autoExpandedPaths,
	onToggle,
	onSelect,
	onAddToFolder,
	onDeleteFolder,
}: {
	node: TreeNode;
	depth: number;
	selectedPage: string | null;
	expandedPaths: Set<string>;
	autoExpandedPaths: Set<string>;
	onToggle: (path: string) => void;
	onSelect: (path: string) => void;
	onAddToFolder: (folderPath: string) => void;
	onDeleteFolder: (folderPath: string) => void;
}) {
	const isSelected = selectedPage === node.path;
	const isExpanded =
		node.isDir && (expandedPaths.has(node.path) || autoExpandedPaths.has(node.path));
	const paddingLeft = 12 + depth * 16;
	const isProtected = node.isDir && ["io", "shared", "squads", "templates"].includes(node.path);

	if (node.isDir) {
		return (
			<div>
				<div
					className="flex w-full items-center group rounded-lg py-2 pr-3 text-left text-[11px] font-mono text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
					style={{ paddingLeft }}
				>
					<button
						type="button"
						onClick={() => onToggle(node.path)}
						className="flex items-center gap-2 flex-1 min-w-0"
					>
						<ChevronRight
							size={14}
							className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
						/>
						{isExpanded ? (
							<FolderOpen size={14} className="shrink-0 text-zinc-500" />
						) : (
							<Folder size={14} className="shrink-0 text-zinc-500" />
						)}
						<span className="truncate">{node.name}</span>
					</button>
					<div className="flex items-center gap-0.5">
						{!isProtected && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onDeleteFolder(node.path);
								}}
								className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-opacity text-zinc-600 hover:text-red-400"
								title={`Delete ${node.name}`}
							>
								<Trash2 size={12} />
							</button>
						)}
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onAddToFolder(node.path);
							}}
							className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.08] transition-opacity text-zinc-600 hover:text-zinc-300"
							title={`Add page to ${node.name}`}
						>
							<Plus size={12} />
						</button>
					</div>
				</div>
				{isExpanded && (
					<div>
						{node.children.map((child) => (
							<TreeItem
								key={child.path}
								node={child}
								depth={depth + 1}
								selectedPage={selectedPage}
								expandedPaths={expandedPaths}
								autoExpandedPaths={autoExpandedPaths}
								onToggle={onToggle}
								onSelect={onSelect}
								onAddToFolder={onAddToFolder}
								onDeleteFolder={onDeleteFolder}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => onSelect(node.path)}
			className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-[11px] font-mono transition-colors ${
				isSelected
					? "border-l-2 border-[#E43A9C] bg-[#E43A9C]/10 text-[#E43A9C]"
					: "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
			}`}
			style={{ paddingLeft }}
		>
			<FileText size={14} className="shrink-0" />
			<span className="truncate">{node.name}</span>
		</button>
	);
}

export function WikiView() {
	const [pages, setPages] = useState<WikiPage[]>([]);
	const [selectedPage, setSelectedPage] = useState<string | null>(null);
	const [content, setContent] = useState("");
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [newPageName, setNewPageName] = useState("");
	const [search, setSearch] = useState("");
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const [creating, setCreating] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const newPageInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		loadPages();
	}, []);

	const tree = useMemo(() => buildTree(pages), [pages]);
	const normalizedQuery = search.trim().toLowerCase();
	const filteredTree = useMemo(() => filterTree(tree, normalizedQuery), [tree, normalizedQuery]);
	const autoExpandedPaths = useMemo(() => {
		const paths = normalizedQuery ? collectDirectoryPaths(filteredTree) : new Set<string>();
		if (selectedPage) {
			for (const ancestor of getAncestorPaths(selectedPage)) {
				paths.add(ancestor);
			}
		}
		return paths;
	}, [filteredTree, normalizedQuery, selectedPage]);
	const selectedNode = selectedPage
		? (function findNode(nodes: TreeNode[]): TreeNode | null {
				for (const n of nodes) {
					if (n.path === selectedPage) return n;
					const found = findNode(n.children);
					if (found) return found;
				}
				return null;
			})(filteredTree)
		: null;
	const selectedPageName =
		selectedNode?.name ?? (selectedPage ? (selectedPage.split("/").pop() ?? "") : "");

	useEffect(() => {
		const directoryPaths = collectDirectoryPaths(tree);
		setExpandedPaths((previous) => {
			// Auto-expand all directories on load/change
			const next = new Set([...previous, ...directoryPaths]);
			return next;
		});
	}, [tree]);

	async function loadPages() {
		try {
			const data = await api.get<{ pages: WikiPage[] }>("/wiki/all");
			setPages(data.pages);
		} catch {
			setPages([]);
		}
	}

	function parseScopePath(fullPath: string): { scope: string; relativePath: string } {
		if (fullPath.startsWith("squads/")) {
			// squads/{squadName}/rest... → scope={squadName}, path=rest...
			const parts = fullPath.split("/");
			const squadName = parts[1] ?? "";
			const relativePath = parts.slice(2).join("/");
			return { scope: squadName, relativePath };
		}
		if (fullPath.startsWith("templates/")) {
			return { scope: "templates", relativePath: fullPath.slice(10) };
		}
		if (fullPath.startsWith("io/")) {
			return { scope: "io", relativePath: fullPath.slice(3) };
		}
		if (fullPath.startsWith("shared/")) {
			return { scope: "shared", relativePath: fullPath.slice(7) };
		}
		// Fallback: treat as shared scope
		return { scope: "shared", relativePath: fullPath };
	}

	async function loadPage(path: string) {
		try {
			const { scope, relativePath } = parseScopePath(path);
			const data = await api.get<{ content: string }>(`/wiki/${scope}/${relativePath}`);
			setContent(data.content);
			setEditContent(data.content);
			setSelectedPage(path);
			setEditing(false);
		} catch {
			toast.error("Failed to load page");
		}
	}

	async function savePage() {
		if (!selectedPage) return;
		try {
			const { scope, relativePath } = parseScopePath(selectedPage);
			await api.put(`/wiki/${scope}/${relativePath}`, { content: editContent });
			setContent(editContent);
			setEditing(false);
			toast.success("Page saved");
		} catch {
			toast.error("Failed to save page");
		}
	}

	async function deletePage() {
		if (!selectedPage) return;
		try {
			const { scope, relativePath } = parseScopePath(selectedPage);
			await api.delete(`/wiki/${scope}/${relativePath}`);
			toast.success("Page deleted");
			setSelectedPage(null);
			setContent("");
			setEditContent("");
			setEditing(false);
			loadPages();
		} catch {
			toast.error("Failed to delete page");
		}
	}

	function handleAddToFolder(folderPath: string) {
		setNewPageName(`${folderPath}/`);
		// Focus input and place cursor at end
		setTimeout(() => {
			const input = newPageInputRef.current;
			if (input) {
				input.focus();
				input.setSelectionRange(input.value.length, input.value.length);
			}
		}, 0);
	}

	function handleDeleteFolder(folderPath: string) {
		setConfirmDelete(folderPath);
	}

	async function confirmDeleteFolder() {
		if (!confirmDelete) return;
		try {
			await api.delete(`/wiki/dir/${confirmDelete}`);
			toast.success(`Deleted ${confirmDelete}`);
			// If the selected page was inside the deleted folder, clear selection
			if (selectedPage?.startsWith(confirmDelete)) {
				setSelectedPage(null);
				setContent("");
				setEditContent("");
				setEditing(false);
			}
			loadPages();
		} catch {
			toast.error("Failed to delete directory");
		} finally {
			setConfirmDelete(null);
		}
	}

	async function createPage() {
		let path = newPageName.trim().replace(/^\/+|\/+$/g, "");
		if (!path) return;
		// Strip .md extension if user included it (backend appends .md)
		path = path.replace(/\.md$/i, "");

		// Default to shared scope if no scope prefix
		const fullPath =
			path.startsWith("io/") || path.startsWith("shared/") || path.startsWith("squads/")
				? path
				: `shared/${path}`;

		setCreating(true);
		try {
			const { scope, relativePath } = parseScopePath(fullPath);
			const title = relativePath.split("/").slice(-1)[0] ?? relativePath;
			await api.put(`/wiki/${scope}/${relativePath}`, { content: `# ${title}\n\n` });
			toast.success("Page created");
			setNewPageName("");
			await loadPages();
			await loadPage(fullPath);
		} catch {
			toast.error("Failed to create page");
		} finally {
			setCreating(false);
		}
	}

	function toggleDirectory(path: string) {
		setExpandedPaths((previous) => {
			const next = new Set(previous);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}

	return (
		<div className="flex h-full">
			<div className="flex h-full w-64 flex-col border-r border-white/[0.07] bg-[#181818]">
				<div className="border-b border-white/[0.07] p-3">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
						<input
							type="text"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search pages..."
							className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] py-2 pl-8 pr-3 text-[11px] font-mono text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-[#E43A9C]/50"
						/>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-2 py-3">
					{filteredTree.length > 0 ? (
						filteredTree.map((node) => (
							<TreeItem
								key={node.path}
								node={node}
								depth={0}
								selectedPage={selectedPage}
								expandedPaths={expandedPaths}
								autoExpandedPaths={autoExpandedPaths}
								onToggle={toggleDirectory}
								onSelect={loadPage}
								onAddToFolder={handleAddToFolder}
								onDeleteFolder={handleDeleteFolder}
							/>
						))
					) : (
						<p className="py-4 text-center font-mono text-[11px] text-zinc-700">No pages found</p>
					)}
				</div>

				<div className="border-t border-white/[0.07] p-3">
					<div className="space-y-2">
						<input
							ref={newPageInputRef}
							type="text"
							value={newPageName}
							onChange={(event) => setNewPageName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") createPage();
								if (event.key === "Escape") setNewPageName("");
							}}
							placeholder="folder/new-page"
							className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-[11px] font-mono text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-[#E43A9C]/50"
						/>
						<PrimaryBtn
							onClick={createPage}
							disabled={!newPageName.trim() || creating}
							className="w-full justify-center px-3 py-2"
						>
							{creating ? (
								<>
									<Loader2 size={13} className="animate-spin" /> Creating...
								</>
							) : (
								<>
									<Plus size={13} /> Add Page
								</>
							)}
						</PrimaryBtn>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden">
				{selectedPage ? (
					<>
						<div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-6">
							<div className="min-w-0">
								<h3 className="truncate font-mono text-sm text-zinc-100">{selectedPageName}</h3>
								<p className="truncate font-mono text-[11px] text-zinc-500">{selectedPage}.md</p>
							</div>
							<div className="flex items-center gap-2">
								{editing ? (
									<>
										<PrimaryBtn onClick={savePage} className="px-3 py-1.5">
											<Save size={12} /> Save
										</PrimaryBtn>
										<SecondaryBtn
											onClick={() => {
												setEditing(false);
												setEditContent(content);
											}}
											className="px-3 py-1.5"
										>
											Cancel
										</SecondaryBtn>
									</>
								) : (
									<SecondaryBtn
										onClick={() => {
											setEditing(true);
											setEditContent(content);
										}}
										className="px-3 py-1.5"
									>
										<Pencil size={12} /> Edit
									</SecondaryBtn>
								)}
								<DangerBtn onClick={deletePage} className="px-3 py-1.5">
									<Trash2 size={12} /> Delete
								</DangerBtn>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto p-6">
							{editing ? (
								<textarea
									value={editContent}
									onChange={(event) => setEditContent(event.target.value)}
									className="h-full min-h-[320px] w-full resize-none rounded-xl border border-white/[0.07] bg-[#181818] p-4 font-mono text-sm text-zinc-300 outline-none focus:border-[#E43A9C]/50"
								/>
							) : (
								<div className="mx-auto max-w-4xl">
									<div
										className="prose-io text-sm text-zinc-300"
										// biome-ignore lint: markdown rendering
										dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
									/>
								</div>
							)}
						</div>
					</>
				) : (
					<div className="flex h-full items-center justify-center">
						<div className="text-center">
							<BookOpen size={48} className="mx-auto mb-3 text-zinc-800" />
							<p className="font-mono text-[11px] text-zinc-700">Select a page to view</p>
						</div>
					</div>
				)}
			</div>

			{/* Confirm delete directory dialog */}
			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#1a1a1a] p-6 shadow-2xl">
						<h3 className="mb-2 text-sm font-medium text-zinc-100">Delete directory?</h3>
						<p className="mb-4 text-xs text-zinc-400">
							This will permanently delete{" "}
							<span className="font-mono text-zinc-200">{confirmDelete}</span> and all its contents.
						</p>
						<div className="flex justify-end gap-2">
							<SecondaryBtn onClick={() => setConfirmDelete(null)} className="px-3 py-1.5">
								Cancel
							</SecondaryBtn>
							<DangerBtn onClick={confirmDeleteFolder} className="px-3 py-1.5">
								<Trash2 size={12} /> Delete
							</DangerBtn>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
