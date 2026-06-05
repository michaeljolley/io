import { IoMark } from "@/components/ui/io-mark";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

export function LoginView() {
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
		<div className="min-h-screen bg-[#161616] flex items-center justify-center relative overflow-hidden">
			{/* Subtle dot grid */}
			<div
				className="absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: "radial-gradient(circle, #E43A9C 1px, transparent 1px)",
					backgroundSize: "32px 32px",
				}}
			/>
			{/* Glow behind logo */}
			<div
				className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[400px] h-[300px] rounded-full blur-3xl pointer-events-none"
				style={{
					background: "radial-gradient(ellipse, rgba(228,58,156,0.12) 0%, transparent 70%)",
				}}
			/>

			<div className="relative z-10 w-full max-w-[360px] mx-4">
				{/* Logo */}
				<div className="flex flex-col items-center mb-8 gap-3">
					<IoMark height={52} />
					<div className="text-center">
						<p className="text-[11px] font-mono text-zinc-600 tracking-widest uppercase mt-1">
							personal ai orchestrator
						</p>
					</div>
				</div>

				<form
					onSubmit={handleSubmit}
					className="glass-card border border-white/[0.07] rounded-2xl p-6 space-y-4"
				>
					<div className="space-y-1">
						<label htmlFor="login-email" className="text-[11px] font-mono text-zinc-500 block">
							Email
						</label>
						<input
							id="login-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#E43A9C]/40 focus:ring-1 focus:ring-[#E43A9C]/15 transition-colors"
						/>
					</div>
					<div className="space-y-1">
						<label htmlFor="login-password" className="text-[11px] font-mono text-zinc-500 block">
							Password
						</label>
						<input
							id="login-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							placeholder="••••••••"
							className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#E43A9C]/40 focus:ring-1 focus:ring-[#E43A9C]/15 transition-colors"
						/>
					</div>

					{error && <p className="text-[11px] font-mono text-red-400">{error}</p>}

					<button
						type="submit"
						disabled={loading}
						className="w-full text-white font-mono text-sm rounded-xl py-3 mt-1 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
						style={{
							background: "linear-gradient(135deg, #D83333 0%, #E43A9C 55%, #F041FF 100%)",
						}}
					>
						{loading ? (
							<>
								<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								Authenticating…
							</>
						) : (
							"Sign In"
						)}
					</button>
				</form>
				<p className="text-center text-[11px] text-zinc-700 font-mono mt-4">
					Secured by Supabase Auth
				</p>
			</div>
		</div>
	);
}
