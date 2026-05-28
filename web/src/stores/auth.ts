import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getSupabase } from "@/lib/supabase";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("io_token"));
  const email = ref<string | null>(localStorage.getItem("io_email"));
  const loading = ref(false);
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  const isAuthenticated = computed(() => !!token.value);

  function isTokenNearExpiry(jwt: string, bufferMs = 300_000): boolean {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      return payload.exp * 1000 <= Date.now() + bufferMs;
    } catch {
      return true;
    }
  }

  // Listen for Supabase auth state changes (handles automatic token refresh)
  function initAuthListener(): void {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        token.value = session.access_token;
        email.value = session.user?.email ?? null;
        localStorage.setItem("io_token", session.access_token);
        if (session.user?.email) localStorage.setItem("io_email", session.user.email);
      } else {
        token.value = null;
        email.value = null;
        localStorage.removeItem("io_token");
        localStorage.removeItem("io_email");
      }
    });

    // Start periodic token health check (every 5 minutes)
    startHealthCheck();
  }

  function startHealthCheck(): void {
    if (healthCheckInterval) return;
    healthCheckInterval = setInterval(async () => {
      if (token.value && isTokenNearExpiry(token.value)) {
        await refreshToken();
      }
    }, 5 * 60 * 1000);
  }

  async function login(emailInput: string, password: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Auth not configured");
    loading.value = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password,
      });
      if (error) throw error;
      token.value = data.session?.access_token ?? null;
      email.value = data.user?.email ?? null;
      if (token.value) localStorage.setItem("io_token", token.value);
      if (email.value) localStorage.setItem("io_email", email.value);
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    token.value = null;
    email.value = null;
    localStorage.removeItem("io_token");
    localStorage.removeItem("io_email");
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  }

  async function refreshToken(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    // First try: normal refresh
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      token.value = data.session.access_token;
      localStorage.setItem("io_token", data.session.access_token);
      return;
    }

    // Fallback: try getSession (may recover from stale refresh token scenarios)
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      token.value = sessionData.session.access_token;
      localStorage.setItem("io_token", sessionData.session.access_token);
      return;
    }

    // Both failed — clear stale token
    token.value = null;
    localStorage.removeItem("io_token");
  }

  return { token, email, loading, isAuthenticated, login, logout, refreshToken, initAuthListener };
});
