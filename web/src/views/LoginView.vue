<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  <div class="dark flex h-full items-center justify-center bg-background px-6">
    <section class="w-full max-w-md rounded-lg border border-border bg-card px-8 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div class="font-mono text-xl font-bold tracking-tight text-primary text-glow-cyan">IO</div>
      <div class="mt-3 text-2xl font-semibold">Mission Control Login</div>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">
        {{ auth.authEnabled ? 'Authenticate against Supabase to access squads, feed, wiki, and orchestration controls.' : 'Authentication is disabled for this workspace.' }}
      </p>

      <div v-if="auth.authEnabled" class="mt-6 space-y-4">
        <label class="block">
          <span class="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">email</span>
          <input v-model="email" type="email" class="w-full rounded border border-border bg-sidebar px-4 py-3 text-sm text-foreground" />
        </label>
        <label class="block">
          <span class="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">password</span>
          <input v-model="password" type="password" class="w-full rounded border border-border bg-sidebar px-4 py-3 text-sm text-foreground" @keydown.enter.prevent="submit" />
        </label>
        <div v-if="error" class="rounded border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ error }}</div>
        <button class="w-full rounded bg-primary/15 px-4 py-3 font-mono text-sm text-primary transition-colors hover:bg-primary/25" :disabled="auth.loading" @click="submit">{{ auth.loading ? 'connecting…' : 'sign in' }}</button>
      </div>

      <button v-else class="mt-6 w-full rounded bg-primary/15 px-4 py-3 font-mono text-sm text-primary transition-colors hover:bg-primary/25" @click="router.push('/chat')">continue to mission control</button>
    </section>
  </div>
</template>
