<template>
  <div class="min-h-screen bg-bg-app flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <div class="text-accent-cyan font-mono font-bold text-3xl tracking-tight mb-1">IO</div>
        <p class="text-text-muted text-sm">Mission Control</p>
      </div>
      <div class="bg-bg-card border border-border rounded-xl p-6 space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs text-text-muted">Email</label>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/50 outline-none transition-colors" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-text-muted">Password</label>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" @keydown.enter="handleSignIn" class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/50 outline-none transition-colors" />
        </div>
        <p v-if="error" class="text-xs text-accent-red">{{ error }}</p>
        <button @click="handleSignIn" class="w-full bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-sm font-medium rounded-lg py-2.5 hover:bg-accent-cyan/20 transition-colors">Sign In</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
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
