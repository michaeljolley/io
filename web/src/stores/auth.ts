import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { supabase } from "@/lib/supabase";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("io_token"));
  const email = ref<string | null>(localStorage.getItem("io_email"));
  const loading = ref(false);

  const isAuthenticated = computed(() => !!token.value);

  async function login(emailInput: string, password: string): Promise<void> {
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
    if (supabase) await supabase.auth.signOut();
    token.value = null;
    email.value = null;
    localStorage.removeItem("io_token");
    localStorage.removeItem("io_email");
  }

  async function refreshToken(): Promise<void> {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      token.value = data.session.access_token;
      localStorage.setItem("io_token", data.session.access_token);
    }
  }

  return { token, email, loading, isAuthenticated, login, logout, refreshToken };
});
