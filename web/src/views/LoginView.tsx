import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { IoMark } from "@/components/IoMark";
import { useAuthStore } from "@/stores/auth";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#161616] flex items-center justify-center relative overflow-hidden">
      {/* subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--base-teal) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* glow behind logo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[400px] h-[300px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(69,162,158,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[360px] mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <IoMark height={52} />
          <div className="text-center">
            <p className="text-[14px] font-mono text-zinc-600 tracking-widest uppercase mt-1">
              personal ai orchestrator
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass-card border border-white/[0.07] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="text-[14px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[14px] font-mono text-zinc-500 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/40 focus:ring-1 focus:ring-[#66FCF1]/15 transition-colors"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[14px] font-mono text-zinc-500 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-[#66FCF1]/40 focus:ring-1 focus:ring-[#66FCF1]/15 transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full text-[#1F2833] font-mono text-sm rounded-xl py-3 mt-1 transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--base-gradient)" }}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#1F2833]/30 border-t-[#1F2833] rounded-full animate-spin" />
                Authenticating…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
