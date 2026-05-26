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

const primaryItems: NavItem[] = [
  { to: '/squads', label: 'Squads', icon: 'grid' },
  { to: '/wiki', label: 'Wiki', icon: 'book' },
  { to: '/skills', label: 'Settings', icon: 'settings', match: ['/skills', '/mcp'] },
]

const utilityItems: NavItem[] = [
  { to: '/chat', label: 'Chat', icon: 'terminal' },
  { to: '/activity', label: 'Activity', icon: 'activity' },
  { to: '/schedules', label: 'Schedules', icon: 'calendar' },
  { to: '/feed', label: 'Feed', icon: 'message', badge: 'feed' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
]

function isActive(item: NavItem) {
  const matches = item.match ?? [item.to]
  return matches.some((value) => route.path.startsWith(value))
}

function badgeValue(item: NavItem) {
  if (item.badge === 'feed') return feedCount.value
  if (item.badge === 'inbox') return inboxCount.value
  return 0
}

async function refreshCounts() {
  try {
    const [feedResponse, inboxResponse] = await Promise.all([
      apiFetch('/api/feed/count'),
      apiFetch('/api/inbox/count'),
    ])

    if (feedResponse.ok) {
      feedCount.value = Number((await feedResponse.json() as { count: number }).count ?? 0)
    }
    if (inboxResponse.ok) {
      inboxCount.value = Number((await inboxResponse.json() as { count: number }).count ?? 0)
    }
  } catch {
    feedCount.value = 0
    inboxCount.value = 0
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
  <aside class="flex w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar py-3">
    <div class="flex flex-col gap-1">
      <RouterLink v-for="item in primaryItems" :key="item.to" :to="item.to" class="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all" :class="isActive(item) ? 'bg-primary/15 text-primary' : 'text-muted-foreground/50 hover:bg-white/[0.04] hover:text-foreground'">
        <AppIcon :name="item.icon" class="h-4 w-4" />
        <div v-if="isActive(item)" class="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" style="left: -4px" />
        <span class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 font-mono text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100">{{ item.label }}</span>
      </RouterLink>
    </div>

    <div class="my-3 h-px w-6 bg-border/80" />

    <div class="flex flex-1 flex-col justify-between">
      <div class="flex flex-col gap-1">
        <RouterLink v-for="item in utilityItems.slice(0, 3)" :key="item.to" :to="item.to" class="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all" :class="isActive(item) ? 'bg-primary/15 text-primary' : 'text-muted-foreground/50 hover:bg-white/[0.04] hover:text-foreground'">
          <AppIcon :name="item.icon" class="h-4 w-4" />
          <div v-if="isActive(item)" class="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" style="left: -4px" />
          <span class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 font-mono text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100">{{ item.label }}</span>
        </RouterLink>
      </div>

      <div class="flex flex-col gap-1">
        <RouterLink v-for="item in utilityItems.slice(3)" :key="item.to" :to="item.to" class="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all" :class="isActive(item) ? 'bg-primary/15 text-primary' : 'text-muted-foreground/50 hover:bg-white/[0.04] hover:text-foreground'">
          <AppIcon :name="item.icon" class="h-4 w-4" />
          <span v-if="badgeValue(item) > 0" class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-bold leading-none text-white">{{ badgeValue(item) }}</span>
          <div v-if="isActive(item)" class="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" style="left: -4px" />
          <span class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 font-mono text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100">{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </aside>
</template>
