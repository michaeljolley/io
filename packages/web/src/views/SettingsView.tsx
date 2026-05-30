import { api } from '@/lib/api';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Config {
	apiPort: number;
	logLevel: string;
	defaultModel: string;
	maxInstancesPerSquad: number;
	dataDir: string;
	pricing: { refreshIntervalHours: number };
	telegram: { botToken: string | null; allowedChatIds: number[] };
	supabase: { projectUrl: string | null; anonKey: string | null; jwtSecret: string | null };
}

type TabId = 'general' | 'telegram' | 'auth' | 'models' | 'advanced';

export function SettingsView() {
	const [config, setConfig] = useState<Config | null>(null);
	const [tab, setTab] = useState<TabId>('general');
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		api
			.get<{ config: Config }>('/config')
			.then((d) => setConfig(d.config))
			.catch(() => {});
	}, []);

	function update(patch: Partial<Config>) {
		if (!config) return;
		setConfig({ ...config, ...patch });
		setDirty(true);
	}

	async function save() {
		if (!config) return;
		try {
			const { dataDir: _, ...rest } = config;
			await api.patch('/config', rest);
			toast.success('Settings saved');
			setDirty(false);
		} catch {
			toast.error('Failed to save settings');
		}
	}

	if (!config) {
		return (
			<div className="h-full flex items-center justify-center text-[var(--color-muted-foreground)]">
				Loading...
			</div>
		);
	}

	const TABS: { id: TabId; label: string }[] = [
		{ id: 'general', label: 'General' },
		{ id: 'telegram', label: 'Telegram' },
		{ id: 'auth', label: 'Auth' },
		{ id: 'models', label: 'Models' },
		{ id: 'advanced', label: 'Advanced' },
	];

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold gradient-text">Settings</h1>
					<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
						Configure IO daemon behavior
					</p>
				</div>
				{dirty && (
					<button
						type="button"
						onClick={save}
						className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm hover:opacity-90"
					>
						<Save size={16} /> Save Changes
					</button>
				)}
			</header>

			{/* Tabs */}
			<div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/3 w-fit">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => setTab(t.id)}
						className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
							tab === t.id
								? 'bg-white/10 text-[var(--color-foreground)]'
								: 'text-[var(--color-muted-foreground)]'
						}`}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="glass-card p-6 max-w-2xl">
				{tab === 'general' && (
					<div className="space-y-4">
						<Field label="Log Level">
							<select
								value={config.logLevel}
								onChange={(e) => update({ logLevel: e.target.value })}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none"
							>
								{['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map((l) => (
									<option key={l} value={l}>
										{l}
									</option>
								))}
							</select>
						</Field>
						<Field label="Default Model">
							<input
								type="text"
								value={config.defaultModel}
								onChange={(e) => update({ defaultModel: e.target.value })}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
							/>
						</Field>
						<Field label="Max Instances Per Squad">
							<input
								type="number"
								value={config.maxInstancesPerSquad}
								onChange={(e) => update({ maxInstancesPerSquad: Number(e.target.value) })}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
								min={1}
								max={10}
							/>
						</Field>
						<Field label="API Port">
							<input
								type="number"
								value={config.apiPort}
								onChange={(e) => update({ apiPort: Number(e.target.value) })}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
							/>
						</Field>
					</div>
				)}

				{tab === 'telegram' && (
					<div className="space-y-4">
						<Field label="Bot Token">
							<input
								type="password"
								value={config.telegram.botToken ?? ''}
								onChange={(e) =>
									update({ telegram: { ...config.telegram, botToken: e.target.value || null } })
								}
								placeholder="Enter Telegram bot token"
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
							/>
						</Field>
						<Field label="Allowed Chat IDs (comma-separated)">
							<input
								type="text"
								value={config.telegram.allowedChatIds.join(', ')}
								onChange={(e) =>
									update({
										telegram: {
											...config.telegram,
											allowedChatIds: e.target.value
												.split(',')
												.map((s) => Number(s.trim()))
												.filter((n) => !Number.isNaN(n)),
										},
									})
								}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] font-mono"
							/>
						</Field>
					</div>
				)}

				{tab === 'auth' && (
					<div className="space-y-4">
						<Field label="Supabase Project URL">
							<input
								type="text"
								value={config.supabase.projectUrl ?? ''}
								onChange={(e) =>
									update({ supabase: { ...config.supabase, projectUrl: e.target.value || null } })
								}
								placeholder="https://your-project.supabase.co"
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] font-mono"
							/>
						</Field>
						<Field label="Supabase Anon Key">
							<input
								type="password"
								value={config.supabase.anonKey ?? ''}
								onChange={(e) =>
									update({ supabase: { ...config.supabase, anonKey: e.target.value || null } })
								}
								placeholder="eyJhbGciOiJIUzI1NiIs..."
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] font-mono"
							/>
						</Field>
						<Field label="JWT Secret">
							<input
								type="password"
								value={config.supabase.jwtSecret ?? ''}
								onChange={(e) =>
									update({ supabase: { ...config.supabase, jwtSecret: e.target.value || null } })
								}
								placeholder="your-jwt-secret"
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)] font-mono"
							/>
						</Field>
						<p className="text-xs text-[var(--color-muted-foreground)]">
							When configured, the web dashboard requires Supabase authentication to access. The JWT
							Secret is used to verify tokens server-side — find it in Supabase project settings →
							API → JWT Settings.
						</p>
					</div>
				)}

				{tab === 'models' && (
					<div className="space-y-4">
						<Field label="Pricing Refresh Interval (hours)">
							<input
								type="number"
								value={config.pricing.refreshIntervalHours}
								onChange={(e) =>
									update({ pricing: { refreshIntervalHours: Number(e.target.value) } })
								}
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
								min={1}
							/>
						</Field>
						<p className="text-xs text-[var(--color-muted-foreground)]">
							Model pricing is auto-refreshed from GitHub docs at this interval.
						</p>
					</div>
				)}

				{tab === 'advanced' && (
					<div className="space-y-4">
						<Field label="Data Directory">
							<input
								type="text"
								value={config.dataDir}
								disabled
								className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none opacity-60 cursor-not-allowed font-mono"
							/>
							<p className="text-xs text-[var(--color-muted-foreground)] mt-1">
								Cannot be changed while daemon is running.
							</p>
						</Field>
					</div>
				)}
			</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
				{label}
			</label>
			{children}
		</div>
	);
}
