<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await auth.signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/chat'
    router.push(redirect)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sign-in failed.'
  }
}

onMounted(() => {
  auth.init()
})
</script>

<template>
  <div class="relative flex h-full items-center justify-center overflow-hidden px-6">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,217,255,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(196,167,255,0.18),transparent_34%)]" />
    <div class="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="rounded-[36px] border border-line bg-[#09090d]/92 p-8 shadow-violet">
        <div class="font-mono text-[11px] uppercase tracking-[0.45em] text-cyan">io control plane</div>
        <h1 class="mt-4 text-5xl font-semibold tracking-tight text-white">Dark-room operator login.</h1>
        <p class="mt-4 max-w-xl text-lg leading-8 text-slate-300">A stripped mission deck for squads, schedules, wiki intelligence, and live orchestration. Built for dense technical work, not marketing chrome.</p>
        <div class="mt-8 space-y-3 rounded-[28px] border border-line bg-panel/90 p-6 font-mono text-sm text-mist">
          <div>> auth handshake to Supabase</div>
          <div>> live SSE task streaming</div>
          <div>> squad worktrees, MCP servers, skill docs</div>
        </div>
      </section>

      <section class="relative overflow-hidden rounded-[36px] border border-cyan/35 bg-surface/95 p-8 shadow-glow">
        <div class="absolute inset-0 opacity-20" style="background-image: linear-gradient(transparent 0, transparent calc(100% - 1px), rgba(0,217,255,0.15) calc(100% - 1px)); background-size: 100% 42px;" />
        <div class="relative">
          <div class="font-mono text-[10px] uppercase tracking-[0.38em] text-cyan">operator auth</div>
          <div class="mt-3 text-3xl font-semibold text-white">{{ auth.authEnabled ? 'Enter credentials' : 'Auth disabled' }}</div>
          <p class="mt-2 text-sm leading-6 text-mist">
            {{ auth.authEnabled ? 'Supabase-backed email and password login.' : 'This environment is running without auth. Continue directly into the app shell.' }}
          </p>

          <div v-if="auth.authEnabled" class="mt-8 space-y-4">
            <label class="block">
              <span class="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-mist">email</span>
              <input v-model="email" type="email" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-mist">password</span>
              <input v-model="password" type="password" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 text-white" @keydown.enter.prevent="submit" />
            </label>
            <div v-if="error" class="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{{ error }}</div>
            <button class="w-full rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-cyan transition hover:bg-cyan/20" :disabled="auth.loading" @click="submit">
              {{ auth.loading ? 'connecting…' : 'sign in' }}
            </button>
          </div>

          <button v-else class="mt-8 w-full rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-cyan transition hover:bg-cyan/20" @click="router.push('/chat')">
            continue to mission control
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
