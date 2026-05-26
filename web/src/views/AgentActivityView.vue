<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import StatusIndicator from '@/components/StatusIndicator.vue'
import { apiFetch, authenticatedUrl } from '@/lib/api'
import { formatRelativeTime, normalizeAgentStatus } from '@/lib/mission-control'

type TaskSummary = {
  task_id: string
  agent_slug: string
  description: string
  status: string
  result?: string | null
  started_at?: string | null
  completed_at?: string | null
}

const tasks = ref<TaskSummary[]>([])
const selectedId = ref('')
const detail = ref<Record<string, unknown> | null>(null)
const activity = ref<Record<string, unknown>[]>([])
const liveEvents = ref<string[]>([])
const search = ref('')
let source: EventSource | null = null

const filteredTasks = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return tasks.value
  return tasks.value.filter((task) => `${task.task_id} ${task.agent_slug} ${task.description} ${task.status}`.toLowerCase().includes(needle))
})

async function loadTasks() {
  const response = await apiFetch('/api/tasks')
  if (!response.ok) return
  tasks.value = (await response.json() as { tasks: TaskSummary[] }).tasks
  if (!selectedId.value && tasks.value[0]) {
    await selectTask(tasks.value[0].task_id)
  }
}

async function attachStream(taskId: string) {
  source?.close()
  liveEvents.value = []
  const url = await authenticatedUrl(`/api/tasks/${encodeURIComponent(taskId)}/events`)
  source = new EventSource(url)
  source.onmessage = (event) => {
    liveEvents.value = [...liveEvents.value.slice(-120), event.data]
  }
  source.onerror = () => {
    source?.close()
    source = null
  }
}

async function selectTask(taskId: string) {
  selectedId.value = taskId
  const [detailResponse, activityResponse] = await Promise.all([
    apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`),
    apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/activity`),
  ])
  detail.value = detailResponse.ok ? await detailResponse.json() as Record<string, unknown> : null
  activity.value = activityResponse.ok ? (await activityResponse.json() as { activity?: Record<string, unknown>[] }).activity ?? [] : []
  await attachStream(taskId)
}

async function cancelTask() {
  if (!selectedId.value) return
  await apiFetch(`/api/tasks/${encodeURIComponent(selectedId.value)}/cancel`, { method: 'POST' })
  await Promise.all([selectTask(selectedId.value), loadTasks()])
}

onMounted(loadTasks)
onUnmounted(() => {
  source?.close()
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-5 p-5 xl:grid-cols-[340px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="border-b border-border px-4 py-4">
        <div class="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Task Activity</div>
        <input v-model="search" class="w-full rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35" placeholder="Filter by task, agent, or status" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button v-for="task in filteredTasks" :key="task.task_id" class="mb-2 w-full rounded-lg border px-4 py-3 text-left transition-colors" :class="selectedId === task.task_id ? 'border-primary/40 bg-primary/10' : 'border-border bg-sidebar/40 hover:bg-white/[0.03]'" @click="selectTask(task.task_id)">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{{ task.description }}</div>
              <div class="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/55">{{ task.agent_slug }} · {{ task.task_id }}</div>
            </div>
            <div class="flex items-center gap-2">
              <StatusIndicator :status="normalizeAgentStatus(task.status)" />
              <span class="font-mono text-[10px] uppercase text-muted-foreground/70">{{ task.status }}</span>
            </div>
          </div>
          <div class="mt-2 font-mono text-[10px] text-muted-foreground/45">{{ formatRelativeTime(task.started_at) }}</div>
        </button>
      </div>
    </section>

    <section class="grid min-h-0 gap-5 lg:grid-rows-[auto_minmax(180px,0.7fr)_minmax(0,1fr)]">
      <div class="rounded-lg border border-border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-foreground">Task Detail</div>
            <div class="mt-2 text-lg font-semibold">{{ selectedId || 'Select a task' }}</div>
          </div>
          <button class="rounded border border-destructive/40 px-3 py-1.5 font-mono text-xs text-destructive transition-colors hover:bg-destructive/10" :disabled="!selectedId" @click="cancelTask">cancel task</button>
        </div>
        <pre class="mt-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-4 font-mono text-xs leading-6 text-foreground/75">{{ detail ? JSON.stringify(detail, null, 2) : 'No task selected.' }}</pre>
      </div>

      <div class="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
        <div class="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60">Activity log</div>
        <div class="h-full overflow-y-auto p-4">
          <article v-for="(entry, index) in activity" :key="index" class="mb-3 rounded-lg border border-white/[0.06] bg-sidebar/60 px-4 py-3 font-mono text-xs text-foreground/75">
            <pre class="whitespace-pre-wrap break-words">{{ JSON.stringify(entry, null, 2) }}</pre>
          </article>
          <div v-if="selectedId && !activity.length" class="rounded-lg border border-dashed border-border px-4 py-10 text-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/45">No activity reported</div>
        </div>
      </div>

      <div class="min-h-0 overflow-hidden rounded-lg border border-primary/20 bg-card">
        <div class="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Live event preview</div>
        <div class="h-full overflow-y-auto px-4 py-4 font-mono text-xs leading-6 text-foreground/75">
          <div v-for="(line, index) in liveEvents" :key="index" class="border-b border-border/40 py-2">{{ line }}</div>
          <div v-if="selectedId && !liveEvents.length" class="py-8 text-center uppercase tracking-[0.22em] text-muted-foreground/45">Waiting for live events</div>
          <div v-if="!selectedId" class="py-8 text-center uppercase tracking-[0.22em] text-muted-foreground/45">Select a task to attach the stream</div>
        </div>
      </div>
    </section>
  </div>
</template>
