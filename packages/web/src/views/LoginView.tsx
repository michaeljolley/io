import { useAuth } from '@/lib/auth';
import { useState } from 'react';

export function LoginView() {
	const { signIn } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const { error: err } = await signIn(email, password);
		if (err) {
			setError(err);
		}
		setLoading(false);
	}

	return (
		<div className="min-h-screen flex items-center justify-center relative z-10">
			{/* Orbs */}
			<div className="orb orb-1" />
			<div className="orb orb-2" />
			<div className="orb orb-3" />

			<div className="glass-card p-8 w-full max-w-sm">
				<div className="text-center mb-6">
					<h1 className="text-2xl font-bold gradient-text">IO</h1>
					<p className="text-sm text-[var(--color-muted-foreground)] mt-1">
						Sign in to your orchestrator
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="email" className="block text-sm font-medium mb-1.5">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-medium mb-1.5">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full px-3 py-2 rounded-md bg-[var(--color-input)] border border-[var(--color-border)] text-sm outline-none focus:border-[var(--color-accent)]"
						/>
					</div>

					{error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

					<button
						type="submit"
						disabled={loading}
						className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
					>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>
			</div>
		</div>
	);
}
