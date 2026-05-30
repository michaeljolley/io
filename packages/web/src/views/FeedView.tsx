import { api } from '@/lib/api';
import { Inbox } from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useState } from 'react';

interface FeedItem {
	id: string;
	kind: string;
	title: string;
	content: string;
	squadId: string | null;
	status: string;
	response: string | null;
	createdAt: string;
}

export function FeedView() {
	const [items, setItems] = useState<FeedItem[]>([]);
	const [selected, setSelected] = useState<FeedItem | null>(null);

	useEffect(() => {
		api
			.get<{ entries: FeedItem[] }>('/inbox')
			.then((d) => setItems(d.entries))
			.catch(() => {});
	}, []);

	function handleSelect(item: FeedItem) {
		setSelected(item);
		if (item.status === 'unread') {
			api
				.post(`/inbox/${item.id}/read`)
				.then(() => {
					setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'read' } : i)));
				})
				.catch(() => {});
		}
	}

	return (
		<div className="flex h-full">
			{/* List */}
			<div className="w-80 border-r border-[var(--color-border)] flex flex-col h-full">
				<header className="h-14 flex items-center px-4 border-b border-[var(--color-border)] shrink-0">
					<h1 className="text-lg font-semibold gradient-text">Feed</h1>
				</header>
				<div className="flex-1 overflow-y-auto">
					{items.map((item) => (
						<button
							key={item.id}
							onClick={() => handleSelect(item)}
							type="button"
							className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-white/3 transition-colors ${
								selected?.id === item.id ? 'bg-white/5' : ''
							}`}
						>
							<div className="flex items-center gap-2">
								{item.status === 'unread' && (
									<span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
								)}
								<span className="text-xs text-[var(--color-muted-foreground)] uppercase">
									{item.kind}
								</span>
							</div>
							<p className="text-sm font-medium mt-1 truncate">{item.title}</p>
							<p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
								{new Date(item.createdAt).toLocaleString()}
							</p>
						</button>
					))}
					{items.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-[var(--color-muted-foreground)]">
							<Inbox size={32} className="opacity-30 mb-2" />
							<p className="text-sm">No items yet</p>
						</div>
					)}
				</div>
			</div>

			{/* Detail */}
			<div className="flex-1 overflow-y-auto p-6">
				{selected ? (
					<div>
						<h2 className="text-xl font-semibold mb-1">{selected.title}</h2>
						<p className="text-xs text-[var(--color-muted-foreground)] mb-4">
							{selected.kind} · {new Date(selected.createdAt).toLocaleString()}
						</p>
						<div
							className="prose-io"
							// biome-ignore lint: markdown rendering
							dangerouslySetInnerHTML={{ __html: marked.parse(selected.content) as string }}
						/>
					</div>
				) : (
					<div className="h-full flex items-center justify-center text-[var(--color-muted-foreground)]">
						Select an item to view details
					</div>
				)}
			</div>
		</div>
	);
}
