import { useEffect } from "react";
import { useLocation } from "react-router";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatOverlay } from "@/components/ChatOverlay";
import { AppRoutes } from "@/routes";
import { useAuthStore } from "@/stores/auth";

export function App() {
  const token = useAuthStore((s) => s.token);
  const initAuthListener = useAuthStore((s) => s.initAuthListener);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const location = useLocation();

  const showChrome = !!token && location.pathname !== "/login";

  useEffect(() => {
    initAuthListener();
    if (token) {
      refreshToken();
    }
    // Only run on mount — token refresh is handled by the auth listener and health check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshToken, initAuthListener]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1a1a]">
      {showChrome && <AppSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {showChrome && <AppHeader />}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#1a1a1a] relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
            <div className="orb orb-pink" />
            <div className="orb orb-gray" />
          </div>
          <div className="relative flex-1 overflow-hidden flex flex-col min-h-0" style={{ zIndex: 1 }}>
            <AppRoutes />
          </div>
        </main>
      </div>
      {showChrome && location.pathname !== "/" && !location.pathname.startsWith("/chat") && <ChatOverlay />}
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
