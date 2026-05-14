<template>
  <div class="relative flex items-center justify-center h-screen bg-surface-0 overflow-hidden">
    <!-- Atmospheric glows -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]"></div>
      <div class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-dim/[0.06] rounded-full blur-[100px]"></div>
    </div>

    <div class="relative w-full max-w-sm mx-4 animate-fade-in">
      <!-- Glass card -->
      <div class="glass rounded-2xl border border-edge p-8 shadow-glow">
        <!-- IO brand mark -->
        <div class="flex flex-col items-center mb-8">
          <div class="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 shadow-glow-sm">
            <span class="text-accent font-mono font-bold text-2xl tracking-tighter">IO</span>
          </div>
          <h1 class="text-xl font-semibold text-txt-primary tracking-tight">Welcome back</h1>
          <p class="text-sm text-txt-muted mt-1">Sign in to continue</p>
        </div>

        <form @submit.prevent="handleSignIn" class="space-y-5">
          <div>
            <label for="email" class="block text-xs font-medium text-txt-secondary mb-1.5 tracking-wide uppercase">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-3.5 py-2.5 bg-surface-0/60 border border-edge rounded-xl text-txt-primary placeholder-txt-muted text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 focus:shadow-glow-sm transition-all duration-200"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-xs font-medium text-txt-secondary mb-1.5 tracking-wide uppercase">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="w-full px-3.5 py-2.5 bg-surface-0/60 border border-edge rounded-xl text-txt-primary placeholder-txt-muted text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 focus:shadow-glow-sm transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <div v-if="error" class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg>
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="auth.loading"
            class="w-full py-2.5 px-4 bg-accent hover:bg-accent-glow disabled:opacity-50 disabled:cursor-not-allowed text-surface-0 font-semibold text-sm rounded-xl transition-all duration-200 shadow-glow-sm hover:shadow-glow"
          >
            {{ auth.loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)

async function handleSignIn() {
  error.value = null
  const err = await auth.signIn(email.value, password.value)
  if (err) {
    error.value = err
  } else {
    router.push('/chat')
  }
}
</script>
