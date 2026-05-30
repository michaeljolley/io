import { api } from '@/lib/api';
import { Calendar, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Schedule {
	id: string;
	name: string;
	targetType: 'squad' | 'orchestrator';
	targetId: string | null;
	cron: string;
	prompt: string;
	enabled: boolean;
	lastRun: string | null;
	nextRun: string | null;
}

export function SchedulesView() {
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [tab, setTab] = useState<'all' | 'squad' | 'orchestrator'>('all');
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({
		name: '',
		cron: '',
		prompt: '',
		targetType: 'orchestrator' as const,
	});

	useEffect(() => {
		loadSchedules();
	}, []);

	function loadSchedules() {
		api
			.get<{ schedules: Schedule[] }>('/schedules')
			.then((d) => setSchedules(d.schedules))
			.catch(() => {});
	}

	const filtered = schedules.filter((s) => tab === 'all' || s.targetType === tab);

	async function handleCreate() {
		if (!form.name || !form.cron || !form.prompt) return;
		try {
			await api.post('/schedules', form);
			toast.success(`Schedule "${form.name}" created`);
			setShowCreate(false);
			setForm({ name: '', cron: '', prompt: '', targetType: 'orchestrator' });
			loadSchedules();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create');
		}
	}

	async function handleToggle(id: string, enabled: boolean) {
		try {
			await api.patch(`/schedules/${id}`, { enabled: !enabled });
			loadSchedules();
		} catch {
			toast.error('Failed to toggle schedule');
		}
	}

	async function handleDelete(id: string) {
		try {
			await api.delete(`/schedules/${id}`);
			toast.success('Schedule deleted');
			loadSchedules();
		} catch {
			toast.error('Failed to delete');
		}
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold gradient-text">Schedules</h1>
					<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
						Automated cron-based tasks
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm hover:opacity-90"
				>
					<Plus size={16} /> New Schedule
				</button>
			</header>

			{/* Tabs */}
			<div className="flex gap-1 mb-4 p-1 rounded-lg bg-white/3 w-fit">
				{(['all', 'orchestrator', 'squad'] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
							tab === t
								? 'bg-white/10 text-[var(--color-foreground)]'
								: 'text-[var(--color-muted-foreground)]'
						}`}
					>
						{t === 'all' ? 'All' : t === 'orchestrator' ? 'IO' : 'Squad'}
					</button>
				))}
			</div>

			{/* Create form */}
			{showCreate && (
				<div className="glass-card p-4 mb-6 space-y-3">
					<h3 className="font-semibold">New Schedule</h3>
					<input
						type="text"
						placeholder="Name"
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
						className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
					/>
					<input
						type="text"
						placeholder="Cron expression (e.g. 0 9 * * 1-5)"
						value={form.cron}
						onChange={(e) => setForm({ ...form, cron: e.target.value })}
						className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] font-mono"
					/>
					<textarea
						placeholder="Prompt to execute"
						value={form.prompt}
						onChange={(e) => setForm({ ...form, prompt: e.target.value })}
						rows={3}
						className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] resize-none"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleCreate}
							className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm"
						>
							Create
						</button>
						<button
							type="button"
							onClick={() => setShowCreate(false)}
							className="px-3 py-1.5 rounded-md bg-white/5 text-sm"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Table */}
			<div className="space-y-2">
				{filtered.map((sched) => (
					<div key={sched.id} className="glass-card p-4 flex items-center gap-4">
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<Calendar size={14} className="text-[var(--color-accent)]" />
								<span className="font-medium text-sm">{sched.name}</span>
								<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[var(--color-muted-foreground)]">
									{sched.targetType}
								</span>
							</div>
							<p className="text-xs text-[var(--color-muted-foreground)] mt-1 font-mono">
								{sched.cron}
							</p>
							<p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate max-w-md">
								{sched.prompt}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleToggle(sched.id, sched.enabled)}
								className={`p-1.5 rounded-md transition-colors ${
									sched.enabled
										? 'text-[var(--color-success)] hover:bg-[var(--color-success)]/10'
										: 'text-[var(--color-muted)] hover:bg-white/5'
								}`}
								title={sched.enabled ? 'Pause' : 'Resume'}
							>
								{sched.enabled ? <Play size={14} /> : <Pause size={14} />}
							</button>
							<button
								type="button"
								onClick={() => handleDelete(sched.id)}
								className="p-1.5 rounded-md text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				))}
			</div>

			{filtered.length === 0 && (
				<div className="text-center py-12 text-[var(--color-muted-foreground)]">
					<Calendar size={48} className="mx-auto mb-3 opacity-30" />
					<p>No schedules. Click New Schedule to create one.</p>
				</div>
			)}
		</div>
	);
}
