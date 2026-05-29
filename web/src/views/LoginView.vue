<script setup lang="ts">
  import { ref } from "vue";
  import { useRouter } from "vue-router";
  import { useAuthStore } from "@/stores/auth";
  import LogoIcon from "@/components/LogoIcon.vue";

  const auth = useAuthStore();
  const router = useRouter();
  const email = ref("");
  const password = ref("");
  const error = ref("");

  async function handleLogin() {
    error.value = "";
    try {
      await auth.login(email.value, password.value);
      router.push("/");
    } catch (err: any) {
      error.value = err.message ?? "Login failed";
    }
  }
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo -->
      <div class="text-center">
        <LogoIcon :size="56" class="mx-auto mb-4" />
        <h1
          class="font-display text-4xl font-normal uppercase tracking-[0.18em] bg-gradient-brand bg-clip-text text-transparent"
        >
          IO
        </h1>
        <p class="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
      </div>

      <!-- Form -->
      <form
        @submit.prevent="handleLogin"
        class="space-y-4 bg-card border border-border rounded-lg p-6"
      >
        <div>
          <label class="text-sm font-medium text-muted-foreground" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label class="text-sm font-medium text-muted-foreground" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="••••••••"
          />
        </div>

        <div v-if="error" class="text-sm text-destructive">{{ error }}</div>

        <button type="submit" :disabled="auth.loading" class="btn-gradient w-full py-2.5">
          {{ auth.loading ? "Signing in..." : "Sign In" }}
        </button>
      </form>

      <p class="text-center text-xs text-muted-foreground">Personal AI Assistant Daemon</p>
    </div>
  </div>
</template>
