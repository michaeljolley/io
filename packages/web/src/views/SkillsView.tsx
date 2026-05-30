import { api } from '@/lib/api';
import { Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Skill {
	name: string;
	activatedForOrchestrator: boolean;
	preview: string;
}

export function SkillsView() {
	const [skills, setSkills] = useState<Skill[]>([]);
	const [showInstall, setShowInstall] = useState(false);
	const [installUrl, setInstallUrl] = useState('');
	const [installName, setInstallName] = useState('');

	useEffect(() => {
		loadSkills();
	}, []);

	function loadSkills() {
		api
			.get<{ skills: Skill[] }>('/skills')
			.then((d) => setSkills(d.skills))
			.catch(() => {});
	}

	async function handleInstall() {
		if (!installName.trim() || !installUrl.trim()) return;
		try {
			await api.post('/skills/install', { name: installName, url: installUrl });
			toast.success(`Skill "${installName}" installed`);
			setShowInstall(false);
			setInstallUrl('');
			setInstallName('');
			loadSkills();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Install failed');
		}
	}

	async function handleRemove(name: string) {
		try {
			await api.delete(`/skills/${name}`);
			toast.success(`Skill "${name}" removed`);
			loadSkills();
		} catch {
			toast.error('Failed to remove skill');
		}
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold gradient-text">Skills</h1>
					<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
						Installed capabilities that extend IO
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowInstall(true)}
					className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm hover:opacity-90 transition-opacity"
				>
					<Plus size={16} /> Install
				</button>
			</header>

			{/* Install modal */}
			{showInstall && (
				<div className="glass-card p-4 mb-6">
					<h3 className="font-semibold mb-3">Install Skill</h3>
					<div className="space-y-3">
						<input
							type="text"
							placeholder="Skill name"
							value={installName}
							onChange={(e) => setInstallName(e.target.value)}
							className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
						/>
						<input
							type="text"
							placeholder="URL to SKILL.md"
							value={installUrl}
							onChange={(e) => setInstallUrl(e.target.value)}
							className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleInstall}
								className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm"
							>
								Install
							</button>
							<button
								type="button"
								onClick={() => setShowInstall(false)}
								className="px-3 py-1.5 rounded-md bg-white/5 text-sm"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				{skills.map((skill) => (
					<div key={skill.name} className="glass-card p-4">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-2">
								<Zap size={16} className="text-[var(--color-accent)]" />
								<h3 className="font-medium text-sm">{skill.name}</h3>
							</div>
							<button
								type="button"
								onClick={() => handleRemove(skill.name)}
								className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] transition-colors"
							>
								<Trash2 size={14} />
							</button>
						</div>
						<p className="text-xs text-[var(--color-muted-foreground)] mt-2 line-clamp-3">
							{skill.preview}
						</p>
						{skill.activatedForOrchestrator && (
							<span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
								Active
							</span>
						)}
					</div>
				))}
			</div>

			{skills.length === 0 && !showInstall && (
				<div className="text-center py-12 text-[var(--color-muted-foreground)]">
					<Zap size={48} className="mx-auto mb-3 opacity-30" />
					<p>No skills installed. Click Install to add one.</p>
				</div>
			)}
		</div>
	);
}
