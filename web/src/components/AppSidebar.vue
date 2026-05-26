<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '@/lib/api'

type NavItem = {
  to: string
  label: string
  code: string
  tone: string
  badge?: 'feed' | 'inbox'
}

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: 'runtime',
    items: [
      { to: '/chat', label: 'Chat', code: 'CH', tone: 'border-cyan/50 text-cyan' },
      { to: '/activity', label: 'Activity', code: 'AC', tone: 'border-violet/50 text-violet' },
      { to: '/feed', label: 'Feed', code: 'FD', tone: 'border-danger/50 text-danger', badge: 'feed' },
      { to: '/inbox', label: 'Inbox', code: 'IB', tone: 'border-success/50 text-success', badge: 'inbox' },
    ],
  },
  {
    title: 'systems',
    items: [
      { to: '/squads', label: 'Squads', code: 'SQ', tone: 'border-violet/50 text-violet' },
      { to: '/schedules', label: 'Schedules', code: 'CR', tone: 'border-cyan/50 text-cyan' },
      { to: '/skills', label: 'Skills', code: 'SK', tone: 'border-success/50 text-success' },
      { to: '/wiki', label: 'Wiki', code: 'WK', tone: 'border-line-bright text-slate-200' },
      { to: '/mcp', label: 'MCP', code: 'MP', tone: 'border-danger/50 text-danger' },
    ],
  },
]

const feedCount = ref(0)
const inboxCount = ref(0)
const health = ref('syncing')
let timer = 0

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

    feedCount.value = feedResponse.ok ? Number((await feedResponse.json() as { count: number }).count ?? 0) : 0
    inboxCount.value = inboxResponse.ok ? Number((await inboxResponse.json() as { count: number }).count ?? 0) : 0
    health.value = 'linked'
  } catch {
    health.value = 'degraded'
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
  <aside class="hidden h-full w-[290px] shrink-0 flex-col border-r border-line bg-[#09090d]/95 px-4 py-4 lg:flex">
    <div class="rounded-[26px] border border-cyan/35 bg-gradient-to-br from-cyan/14 via-panel to-panel px-4 py-5 shadow-glow">
      <div class="font-mono text-[11px] uppercase tracking-[0.4em] text-cyan">io / mission control</div>
      <div class="mt-3 text-3xl font-semibold text-white">Operator Deck</div>
      <div class="mt-2 max-w-xs text-sm leading-6 text-mist">Dense control surface for squads, automations, docs, and live agent streams.</div>
    </div>

    <div class="mt-4 rounded-[22px] border border-line bg-surface/90 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-mist">
      <div class="flex items-center justify-between">
        <span>link state</span>
        <span :class="health === 'linked' ? 'text-success' : health === 'degraded' ? 'text-danger' : 'text-cyan'">{{ health }}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 text-[10px] tracking-[0.18em]">
        <div class="rounded-2xl border border-line bg-panel px-3 py-2">
          <div class="text-mist">feed</div>
          <div class="mt-1 text-lg text-white">{{ feedCount }}</div>
        </div>
        <div class="rounded-2xl border border-line bg-panel px-3 py-2">
          <div class="text-mist">inbox</div>
          <div class="mt-1 text-lg text-white">{{ inboxCount }}</div>
        </div>
      </div>
    </div>

    <div class="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
      <section v-for="group in groups" :key="group.title" class="mb-6">
        <div class="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.3em] text-mist">{{ group.title }}</div>
        <div class="space-y-2">
          <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" custom v-slot="{ isActive, navigate }">
            <button
              class="group flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition"
              :class="isActive ? 'border-cyan bg-cyan/10 shadow-glow' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
              @click="navigate"
            >
              <span class="flex h-11 w-11 items-center justify-center rounded-2xl border bg-black/20 font-mono text-xs font-semibold" :class="item.tone">
                {{ item.code }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-white">{{ item.label }}</span>
                <span class="block font-mono text-[11px] uppercase tracking-[0.2em] text-mist">/{{ item.label.toLowerCase() }}</span>
              </span>
              <span v-if="badgeValue(item)" class="rounded-full border border-danger/50 bg-danger/10 px-2 py-1 font-mono text-[10px] text-danger">
                {{ badgeValue(item) }}
              </span>
            </button>
          </RouterLink>
        </div>
      </section>
    </div>
  </aside>
</template>
