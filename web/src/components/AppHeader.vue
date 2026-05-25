<template>
  <header class="shrink-0 h-11 bg-bg-surface border-b border-border flex items-center justify-between px-4">
    <div class="flex items-center gap-0 min-w-0">
      <button class="md:hidden w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text mr-2" @click="$emit('toggle-sidebar')">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/></svg>
      </button>
      <span class="text-accent-cyan font-mono font-bold text-lg tracking-tight select-none">IO</span>
      <div class="w-px h-3.5 bg-border mx-3"></div>
      <span class="text-text-muted text-xs tracking-wide hidden sm:block truncate">Mission Control · Developer AI Assistant</span>
    </div>
    <router-link to="/feed" class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors" @click="onFeedClick">
      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.86-1.5l.92-2.1V7.57A5.9 5.9 0 0 1 10 2Z"/></svg>
      <span class="text-xs">Feed</span>
      <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent-red text-text text-[9px] font-bold leading-none px-1">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </router-link>
  </header>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../stores/auth'

defineEmits<{ 'toggle-sidebar': [] }>()

const auth = useAuthStore()
const unreadCount = ref(0)

function onFeedClick() {
  unreadCount.value = 0
}

onMounted(async () => {
  await auth.init()
  if (auth.authEnabled && !auth.user) return
  try {
    const res = await apiFetch('/api/feed/count')
    if (res.ok) {
      const data = (await res.json()) as { count?: number }
      unreadCount.value = data.count ?? 0
    }
  } catch { /* best effort */ }
})
</script>
