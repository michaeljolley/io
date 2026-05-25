<template>
  <header class="shrink-0 h-11 flex items-center justify-between px-4 bg-bg-surface border-b border-border">
    <!-- Left -->
    <div class="flex items-center gap-0">
      <!-- Mobile hamburger -->
      <button
        class="md:hidden p-1.5 mr-2 rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors"
        @click="$emit('toggle-sidebar')"
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/></svg>
      </button>
      <span class="text-accent-cyan font-mono font-bold text-lg select-none">IO</span>
      <div class="w-px h-3 bg-border mx-3"></div>
      <span class="text-text-muted text-xs hidden sm:inline">Mission Control · Developer AI Assistant</span>
    </div>
    <!-- Right -->
    <router-link
      to="/feed"
      class="relative flex items-center gap-1.5 px-3 py-1 rounded-md text-text-muted hover:bg-bg-elevated hover:text-text transition-colors"
      @click="onFeedClick"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/></svg>
      <span class="text-xs">Feed</span>
      <!-- Unread badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-4 h-4 flex items-center justify-center rounded-full bg-accent-red text-white text-[9px] font-bold px-1"
      >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
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
