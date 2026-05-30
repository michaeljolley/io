import { api } from '@/lib/api';
import { Activity, ExternalLink, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

interface SquadSummary {
	id: string;
	name: string;
	universe: string;
	repoUrl: string;
	status: string;
	memberCount: number;
	activeInstances: number;
	createdAt: string;
}

interface SquadMember {
	id: string;
	displayName: string;
	role: string;
	persona: string | null;
	veto: boolean;
	status: string;
	currentTask: string | null;
}

interface SquadDetail {
	squad: {
		id: string;
		name: string;
		universe: string;
		repoUrl: string;
		status: string;
		autonomyTier: string;
		createdAt: string;
	};
	members: SquadMember[];
	instances: Array<{
		id: string;
		status: string;
		issueRef: string | null;
		branch: string | null;
		taskCount: number;
		tasksComplete: number;
	}>;
}

export function SquadsView() {
	const { name } = useParams<{ name: string }>();

	if (name) {
		return <SquadDetailView name={name} />;
	}

	return <SquadListView />;
}

function SquadListView() {
	const [squads, setSquads] = useState<SquadSummary[]>([]);

	useEffect(() => {
		api
			.get<{ squads: SquadSummary[] }>('/squads')
			.then((d) => setSquads(d.squads))
			.catch(() => {});
	}, []);

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold gradient-text">Squads</h1>
				<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
					Active teams working on your projects
				</p>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				{squads.map((squad) => (
					<a
						key={squad.id}
						href={`/squads/${squad.name}`}
						className="glass-card p-5 hover:border-[var(--color-accent)]/30 transition-colors block"
					>
						<div className="flex items-start justify-between mb-3">
							<div>
								<h3 className="font-semibold text-[var(--color-foreground)]">{squad.name}</h3>
								<p className="text-xs text-[var(--color-muted-foreground)]">{squad.universe}</p>
							</div>
							<StatusBadge status={squad.status} />
						</div>

						<div className="flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
							<span className="flex items-center gap-1">
								<Users size={12} /> {squad.memberCount} members
							</span>
							<span className="flex items-center gap-1">
								<Activity size={12} /> {squad.activeInstances} active
							</span>
						</div>

						{squad.repoUrl && (
							<div className="mt-3 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
								<ExternalLink size={11} />
								<span className="truncate">{squad.repoUrl}</span>
							</div>
						)}
					</a>
				))}

				{squads.length === 0 && (
					<div className="col-span-full text-center py-12 text-[var(--color-muted-foreground)]">
						<Users size={48} className="mx-auto mb-3 opacity-30" />
						<p>No squads hired yet. Ask IO to hire a squad for a project.</p>
					</div>
				)}
			</div>
		</div>
	);
}

function SquadDetailView({ name }: { name: string }) {
	const [detail, setDetail] = useState<SquadDetail | null>(null);

	useEffect(() => {
		api
			.get<SquadDetail>(`/squads/${name}`)
			.then(setDetail)
			.catch(() => {});
	}, [name]);

	if (!detail) {
		return (
			<div className="h-full flex items-center justify-center text-[var(--color-muted-foreground)]">
				Loading...
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold gradient-text">{detail.squad.name}</h1>
				<p className="text-sm text-[var(--color-muted-foreground)]">
					{detail.squad.universe} · {detail.squad.autonomyTier} autonomy
				</p>
			</header>

			{/* Members */}
			<section className="mb-8">
				<h2 className="text-lg font-semibold mb-3">Team Members</h2>
				<div className="grid gap-3">
					{detail.members.map((m) => (
						<div key={m.id} className="glass-card p-4 flex items-center gap-4">
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium">{m.displayName}</span>
									<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[var(--color-muted-foreground)]">
										{m.role}
									</span>
									{m.veto && (
										<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
											veto
										</span>
									)}
								</div>
								{m.persona && (
									<p className="text-xs text-[var(--color-muted-foreground)] mt-1">{m.persona}</p>
								)}
								{m.currentTask && (
									<p className="text-xs text-[var(--color-accent)] mt-1">⚡ {m.currentTask}</p>
								)}
							</div>
							<StatusBadge status={m.status} />
						</div>
					))}
				</div>
			</section>

			{/* Instances */}
			{detail.instances.length > 0 && (
				<section>
					<h2 className="text-lg font-semibold mb-3">Instances</h2>
					<div className="grid gap-3">
						{detail.instances.map((inst) => (
							<div key={inst.id} className="glass-card p-4">
								<div className="flex items-center justify-between">
									<div>
										<span className="font-mono text-xs">{inst.id.slice(0, 8)}</span>
										{inst.issueRef && (
											<span className="ml-2 text-xs text-[var(--color-accent)]">
												{inst.issueRef}
											</span>
										)}
									</div>
									<StatusBadge status={inst.status} />
								</div>
								<div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
									Tasks: {inst.tasksComplete}/{inst.taskCount} complete
									{inst.branch && <span className="ml-3">Branch: {inst.branch}</span>}
								</div>
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		active: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
		working: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
		idle: 'bg-white/5 text-[var(--color-muted-foreground)]',
		reviewing: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
		complete: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
		failed: 'bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]',
		planning: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
		meeting: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
	};

	return (
		<span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? colors.idle}`}>
			{status}
		</span>
	);
}
