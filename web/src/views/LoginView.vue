<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

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
    <div class="w-full max-w-sm space-y-6">
      <!-- Logo -->
      <div class="text-center">
        <div class="text-4xl mb-2">🤖</div>
        <h1 class="text-2xl font-bold">IO</h1>
        <p class="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="text-sm font-medium" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label class="text-sm font-medium" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="••••••••"
          />
        </div>

        <div v-if="error" class="text-sm text-destructive">{{ error }}</div>

        <button
          type="submit"
          :disabled="auth.loading"
          class="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {{ auth.loading ? "Signing in..." : "Sign In" }}
        </button>
      </form>
    </div>
  </div>
</template>
