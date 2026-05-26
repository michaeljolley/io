<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { apiFetch, authenticatedUrl } from '@/lib/api'

type TaskSummary = {
  task_id: string
  agent_slug: string
  description: string
  status: string
  result?: string | null
  origin_channel?: string | null
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
  if (response.ok) {
    tasks.value = (await response.json() as { tasks: TaskSummary[] }).tasks
    if (!selectedId.value && tasks.value[0]) {
      await selectTask(tasks.value[0].task_id)
    }
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
  await selectTask(selectedId.value)
  await loadTasks()
}

onMounted(loadTasks)
onUnmounted(() => {
  source?.close()
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">task lanes</div>
        <input v-model="search" class="focus-ring mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="filter by agent, id, or status" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          v-for="task in filteredTasks"
          :key="task.task_id"
          class="mb-2 w-full rounded-[22px] border px-4 py-4 text-left transition"
          :class="selectedId === task.task_id ? 'border-cyan bg-cyan/10' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
          @click="selectTask(task.task_id)"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-white">{{ task.description }}</div>
              <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{{ task.agent_slug }} · {{ task.task_id }}</div>
            </div>
            <div class="font-mono text-[11px] uppercase tracking-[0.18em]" :class="task.status === 'completed' ? 'text-success' : task.status === 'failed' ? 'text-danger' : 'text-cyan'">{{ task.status }}</div>
          </div>
          <div class="mt-3 font-mono text-[11px] text-slate-400">{{ task.started_at ? new Date(task.started_at).toLocaleString() : 'queued' }}</div>
        </button>
      </div>
    </section>

    <section class="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(180px,0.7fr)_minmax(0,1fr)]">
      <div class="rounded-[28px] border border-violet/35 bg-surface/95 p-5 shadow-violet">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">task detail</div>
            <div class="mt-2 text-2xl font-semibold text-white">{{ selectedId || 'Select a task' }}</div>
          </div>
          <button class="rounded-2xl border border-danger/40 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-danger" :disabled="!selectedId" @click="cancelTask">cancel task</button>
        </div>
        <pre class="mt-4 overflow-x-auto rounded-2xl border border-line bg-black/30 p-4 font-mono text-xs leading-6 text-slate-200">{{ detail ? JSON.stringify(detail, null, 2) : 'No task selected.' }}</pre>
      </div>

      <div class="min-h-0 overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
        <div class="border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">activity log</div>
        <div class="h-full overflow-y-auto p-4">
          <article v-for="(entry, index) in activity" :key="index" class="mb-3 rounded-[20px] border border-line bg-panel px-4 py-3 font-mono text-xs text-slate-200">
            <pre class="whitespace-pre-wrap break-words">{{ JSON.stringify(entry, null, 2) }}</pre>
          </article>
          <div v-if="selectedId && !activity.length" class="rounded-[20px] border border-dashed border-line px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no activity reported</div>
        </div>
      </div>

      <div class="min-h-0 overflow-hidden rounded-[28px] border border-cyan/35 bg-surface/95 shadow-glow">
        <div class="border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">live event preview</div>
        <div class="h-full overflow-y-auto px-5 py-4 font-mono text-xs leading-6 text-slate-200">
          <div v-for="(line, index) in liveEvents" :key="index" class="border-b border-line/50 py-2">{{ line }}</div>
          <div v-if="selectedId && !liveEvents.length" class="py-8 text-center uppercase tracking-[0.24em] text-mist">waiting for live events</div>
        </div>
      </div>
    </section>
  </div>
</template>
