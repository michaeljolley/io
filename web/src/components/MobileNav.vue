<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { apiFetch } from '@/lib/api'

type NavItem = {
  to: string
  label: string
  icon: string
  match?: string[]
  badge?: 'feed' | 'inbox'
}

const route = useRoute()
const feedCount = ref(0)
const inboxCount = ref(0)
let timer = 0

const items: NavItem[] = [
  { to: '/squads', label: 'Squads', icon: 'grid' },
  { to: '/chat', label: 'Chat', icon: 'terminal' },
  { to: '/activity', label: 'Activity', icon: 'activity' },
  { to: '/feed', label: 'Feed', icon: 'message', badge: 'feed' },
  { to: '/wiki', label: 'Wiki', icon: 'book' },
  { to: '/skills', label: 'Settings', icon: 'settings', match: ['/skills', '/mcp'] },
]

function isActive(item: NavItem) {
  const matches = item.match ?? [item.to]
  return matches.some((m) => route.path.startsWith(m))
}

function badgeValue(item: NavItem) {
  if (item.badge === 'feed') return feedCount.value
  if (item.badge === 'inbox') return inboxCount.value
  return 0
}

async function refreshCounts() {
  try {
    const [feedRes, inboxRes] = await Promise.all([
      apiFetch('/api/feed/count'),
      apiFetch('/api/inbox/count'),
    ])
    if (feedRes.ok) feedCount.value = Number((await feedRes.json() as { count: number }).count ?? 0)
    if (inboxRes.ok) inboxCount.value = Number((await inboxRes.json() as { count: number }).count ?? 0)
  } catch {
    // ignore
  }
}

onMounted(() => {
  refreshCounts()
  timer = window.setInterval(refreshCounts, 15000)
})

onUnmounted(() => {
  window.clearInterval(timer)
})
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-sidebar px-2 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors"
      :class="isActive(item) ? 'text-primary' : 'text-muted-foreground/50'"
    >
      <span v-if="badgeValue(item) > 0" class="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 font-mono text-[8px] font-bold leading-none text-white">{{ badgeValue(item) }}</span>
      <AppIcon :name="item.icon" class="h-5 w-5" />
      <span class="font-mono text-[10px]">{{ item.label }}</span>
      <div v-if="isActive(item)" class="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
    </RouterLink>
  </nav>
</template>
