import { ArrowRight, Bell, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/auth";

export function AppHeader() {
  const [flyout, setFlyout] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const email = useAuthStore((s) => s.email);
  const navigate = useNavigate();

  // TODO: Wire to real feed store unread count
  const feedCount = 0;

  return (
    <div className="h-[52px] flex-shrink-0 flex items-center justify-end px-4 border-b border-white/[0.06] bg-[var(--base-black)]">
      {/* <div className="flex items-center gap-2">
        <StatusDot status="connected" />
        <span className="text-[14px] font-mono text-green-400">connected</span>
      </div> */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setFlyout(!flyout)}
            className="relative p-2 cursor-pointer rounded-xl hover:bg-white/[0.05] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {feedCount > 0 && (
              <span
                className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[10px] font-mono text-white flex items-center justify-center leading-none"
                style={{ background: "linear-gradient(135deg, #45A29E, #F75F57)" }}
              >
                {feedCount}
              </span>
            )}
          </button>
          {flyout && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFlyout(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#1e1e1e] border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                  <p className="text-[14px] font-mono text-zinc-500">Recent Activity</p>
                </div>
                <div className="px-4 py-6 text-center text-[14px] font-mono text-zinc-700">No new activity</div>
                <div className="px-4 py-2 text-center border-t border-white/[0.04]">
                  <button
                    onClick={() => {
                      setFlyout(false);
                      navigate("/feed");
                    }}
                    className="text-[14px] cursor-pointer font-mono text-[#66FCF1] hover:text-[#D789F3] transition-colors flex items-center gap-1 mx-auto"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="w-px h-4 bg-white/[0.08]" />
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center border border-[#66FCF1]/20"
          style={{ background: "rgba(102,252,241,0.12)" }}
        >
          <span className="text-[13px] font-mono text-[#66FCF1]">{email?.[0]?.toUpperCase() ?? "A"}</span>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 cursor-pointer rounded-xl hover:bg-white/[0.05] text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
