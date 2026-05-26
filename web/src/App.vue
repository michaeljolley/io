<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import FeedFlyout from '@/components/FeedFlyout.vue'
import FloatingChat from '@/components/FloatingChat.vue'
import { apiFetch } from '@/lib/api'
import { formatRelativeTime, type SquadSummary } from '@/lib/mission-control'
import { useAuthStore } from '@/stores/auth'

type TaskSummary = {
  status: string
}

const route = useRoute()
const auth = useAuthStore()
const floatingChat = ref<{ open: () => void } | null>(null)
const feedOpen = ref(false)
const unreadCount = ref(0)
const lastSyncAt = ref<string | null>(null)
const metrics = ref({
  squads: 0,
  agents: 0,
  instances: 0,
  runningInstances: 0,
  working: 0,
})
let timer = 0

const shellVisible = computed(() => route.name !== 'login' && auth.isAuthenticated)
const lastSyncLabel = computed(() => formatRelativeTime(lastSyncAt.value))

function openChat() {
  floatingChat.value?.open()
}

function handleShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === '.') {
    event.preventDefault()
    openChat()
  }
}

async function refreshShell() {
  try {
    const [feedResponse, squadsResponse, tasksResponse] = await Promise.all([
      apiFetch('/api/feed/count'),
      apiFetch('/api/squads'),
      apiFetch('/api/tasks'),
    ])

    if (feedResponse.ok) {
      unreadCount.value = Number((await feedResponse.json() as { count: number }).count ?? 0)
    }

    if (squadsResponse.ok) {
      const payload = await squadsResponse.json() as { squads: SquadSummary[] }
      metrics.value.squads = payload.squads.length
      metrics.value.agents = payload.squads.reduce((sum, squad) => sum + Number(squad.agents_count ?? 0), 0)
      metrics.value.instances = payload.squads.reduce((sum, squad) => sum + Number(squad.instances_total ?? 0), 0)
      metrics.value.runningInstances = payload.squads.reduce((sum, squad) => sum + Number(squad.instances_active ?? 0), 0)
    }

    if (tasksResponse.ok) {
      const payload = await tasksResponse.json() as { tasks: TaskSummary[] }
      metrics.value.working = payload.tasks.filter((task) => /running|working|queued|pending|in_progress/i.test(task.status)).length
    }

    lastSyncAt.value = new Date().toISOString()
  } catch {
    // keep previous metrics when offline
  }
}

onMounted(() => {
  auth.init()
  refreshShell()
  timer = window.setInterval(refreshShell, 30000)
  window.addEventListener('keydown', handleShortcut)
})

onUnmounted(() => {
  window.clearInterval(timer)
  window.removeEventListener('keydown', handleShortcut)
})
</script>

<template>
  <div class="dark flex h-full flex-col overflow-hidden bg-background text-foreground">
    <template v-if="shellVisible">
      <div class="flex shrink-0 items-center justify-between border-b border-border bg-sidebar px-5 py-3">
        <div class="flex items-center gap-4">
          <div class="select-none pl-1 font-mono text-xl font-bold tracking-tight text-primary text-glow-cyan">IO</div>
          <div class="h-4 w-px bg-border" />
          <div class="font-mono text-xs text-muted-foreground">Mission Control · Developer AI Assistant</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="relative flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground" @click="feedOpen = true">
            <AppIcon name="message" class="h-4 w-4" />
            <span class="text-xs font-medium">Feed</span>
            <span v-if="unreadCount > 0" class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive font-mono text-[9px] font-bold text-white">{{ unreadCount }}</span>
          </button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-hidden">
            <RouterView />
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-border bg-sidebar px-5 py-2">
        <div class="flex items-center justify-between font-mono text-[11px]">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <AppIcon name="circle" class="h-2 w-2 text-status-success" />
              <span class="text-muted-foreground">Daemon running</span>
            </div>
            <span class="text-muted-foreground/40">·</span>
            <span class="text-muted-foreground">{{ metrics.squads }} squads · {{ metrics.agents }} agents</span>
            <span class="text-muted-foreground/40">·</span>
            <span class="text-accent-foreground">{{ metrics.runningInstances }}/{{ metrics.instances }} instances active</span>
          </div>
          <div class="flex items-center gap-4">
            <div v-if="metrics.working > 0" class="flex items-center gap-1.5 text-primary">
              <AppIcon name="activity" class="h-3 w-3" />
              <span>{{ metrics.working }} working</span>
            </div>
            <span class="text-muted-foreground/40">Last sync: {{ lastSyncLabel }}</span>
          </div>
        </div>
      </div>

      <FeedFlyout :open="feedOpen" @close="feedOpen = false" />
      <FloatingChat ref="floatingChat" />
    </template>

    <div v-else class="h-full">
      <RouterView />
    </div>
  </div>
</template>
