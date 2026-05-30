import { api } from '@/lib/api';
import { BookOpen, FileText, Plus, Save } from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface WikiPage {
	name: string;
	path: string;
}

export function WikiView() {
	const [scope, setScope] = useState('shared');
	const [pages, setPages] = useState<WikiPage[]>([]);
	const [selectedPage, setSelectedPage] = useState<string | null>(null);
	const [content, setContent] = useState('');
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState('');
	const [creating, setCreating] = useState(false);
	const [newPageName, setNewPageName] = useState('');

	useEffect(() => {
		loadPages();
	}, [scope]);

	function loadPages() {
		api
			.get<{ scope: string; pages: WikiPage[] }>(`/wiki/${scope}`)
			.then((d) => setPages(d.pages))
			.catch(() => setPages([]));
	}

	async function loadPage(name: string) {
		try {
			const data = await api.get<{ content: string }>(`/wiki/${scope}/${name}`);
			setContent(data.content);
			setSelectedPage(name);
			setEditing(false);
		} catch {
			toast.error('Failed to load page');
		}
	}

	async function savePage() {
		if (!selectedPage) return;
		try {
			await api.put(`/wiki/${scope}/${selectedPage}`, { content: editContent });
			setContent(editContent);
			setEditing(false);
			toast.success('Page saved');
		} catch {
			toast.error('Failed to save');
		}
	}

	async function createPage() {
		if (!newPageName.trim()) return;
		try {
			await api.put(`/wiki/${scope}/${newPageName}`, { content: `# ${newPageName}\n\n` });
			toast.success('Page created');
			setCreating(false);
			setNewPageName('');
			loadPages();
			loadPage(newPageName);
		} catch {
			toast.error('Failed to create page');
		}
	}

	return (
		<div className="flex h-full">
			{/* Sidebar */}
			<div className="w-64 border-r border-[var(--color-border)] flex flex-col h-full">
				<header className="h-14 flex items-center px-4 border-b border-[var(--color-border)] shrink-0">
					<h1 className="text-lg font-semibold gradient-text">Wiki</h1>
				</header>

				{/* Scope selector */}
				<div className="flex gap-1 p-2 border-b border-[var(--color-border)]">
					{['io', 'shared'].map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => {
								setScope(s);
								setSelectedPage(null);
							}}
							className={`px-2 py-1 rounded text-xs ${
								scope === s
									? 'bg-white/10 text-[var(--color-foreground)]'
									: 'text-[var(--color-muted-foreground)]'
							}`}
						>
							{s}
						</button>
					))}
				</div>

				{/* Pages */}
				<div className="flex-1 overflow-y-auto p-2">
					{pages.map((page) => (
						<button
							key={page.name}
							type="button"
							onClick={() => loadPage(page.name)}
							className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
								selectedPage === page.name ? 'bg-white/10' : 'hover:bg-white/5'
							}`}
						>
							<FileText size={14} className="text-[var(--color-muted-foreground)]" />
							{page.name}
						</button>
					))}
				</div>

				{/* Create page */}
				<div className="p-2 border-t border-[var(--color-border)]">
					{creating ? (
						<div className="flex gap-1">
							<input
								type="text"
								value={newPageName}
								onChange={(e) => setNewPageName(e.target.value)}
								placeholder="page-name"
								className="flex-1 px-2 py-1 rounded text-xs bg-[var(--color-input)] border border-[var(--color-border)] outline-none"
								onKeyDown={(e) => e.key === 'Enter' && createPage()}
							/>
							<button
								type="button"
								onClick={createPage}
								className="px-2 py-1 rounded text-xs bg-[var(--color-accent)] text-white"
							>
								OK
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setCreating(true)}
							className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[var(--color-muted-foreground)] hover:bg-white/5"
						>
							<Plus size={14} /> New page
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{selectedPage ? (
					<>
						<div className="h-14 flex items-center px-6 border-b border-[var(--color-border)] justify-between shrink-0">
							<h2 className="font-semibold">{selectedPage}</h2>
							<div className="flex gap-2">
								{editing ? (
									<button
										type="button"
										onClick={savePage}
										className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs"
									>
										<Save size={12} /> Save
									</button>
								) : (
									<button
										type="button"
										onClick={() => {
											setEditing(true);
											setEditContent(content);
										}}
										className="px-3 py-1.5 rounded-md bg-white/5 text-xs hover:bg-white/10"
									>
										Edit
									</button>
								)}
							</div>
						</div>
						<div className="flex-1 overflow-y-auto p-6">
							{editing ? (
								<textarea
									value={editContent}
									onChange={(e) => setEditContent(e.target.value)}
									className="w-full h-full bg-transparent font-mono text-sm outline-none resize-none"
								/>
							) : (
								<div
									className="prose-io"
									// biome-ignore lint: markdown rendering
									dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
								/>
							)}
						</div>
					</>
				) : (
					<div className="h-full flex items-center justify-center text-[var(--color-muted-foreground)]">
						<div className="text-center">
							<BookOpen size={48} className="mx-auto mb-3 opacity-30" />
							<p>Select a page to view</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
