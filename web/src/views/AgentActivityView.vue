<template>
  <div class="h-full p-5"><div class="h-full flex overflow-hidden bg-bg-card border border-border rounded-lg"><div class="w-72 shrink-0 bg-bg-surface border-r border-border flex flex-col overflow-hidden"><div class="px-4 h-11 border-b border-border flex items-center justify-between shrink-0"><span class="text-sm font-medium text-text">Activity</span><span v-if="activeAgents.length" class="flex items-center gap-1.5 text-[11px] text-accent-cyan"><span class="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></span>{{ activeAgents.length }} active</span></div><div class="flex-1 overflow-y-auto"><div v-if="loading && !tasks.length" class="p-4 text-text-muted text-xs text-center">Loading...</div><button v-for="task in tasks" :key="task.task_id" @click="openTask(task.task_id)" class="w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-bg-elevated/50 relative" :class="selectedTaskId === task.task_id ? 'bg-bg-elevated' : ''"><span v-if="selectedTaskId === task.task_id" class="absolute left-0 top-0 h-full w-[3px] bg-accent-cyan rounded-r"></span><div class="flex items-center justify-between mb-1 gap-2"><span :class="taskStatusClass(task.status)" class="text-[9px] px-1.5 py-0.5 rounded-sm font-mono border">{{ task.status }}</span><span class="text-[10px] text-text-muted font-mono shrink-0">{{ formatShortTime(task.started_at) }}</span></div><p class="text-xs text-text truncate">{{ task.description }}</p><p class="text-[10px] text-text-muted font-mono truncate mt-0.5">{{ task.agent_slug }}</p></button><div v-if="!loading && !tasks.length" class="p-4 text-text-muted text-xs text-center">No tasks</div></div></div><div class="flex-1 flex flex-col overflow-hidden"><div v-if="!selectedTaskId" class="flex-1 flex items-center justify-center text-text-muted text-sm">Select a task to view activity</div><template v-else><div class="h-11 shrink-0 border-b border-border flex items-center justify-between px-4 gap-4"><div class="flex items-center gap-2 min-w-0"><span v-if="selectedTask" :class="taskStatusClass(selectedTask.status)" class="text-[9px] px-1.5 py-0.5 rounded-sm font-mono border shrink-0">{{ selectedTask.status }}</span><span v-if="durationLabel" class="text-[11px] text-text-muted font-mono shrink-0">{{ durationLabel }}</span><span class="text-sm text-text truncate">{{ selectedTask?.description ?? '...' }}</span></div><div class="flex items-center gap-2 shrink-0"><button v-if="selectedTask?.status === 'running'" @click="stopTask(selectedTask.task_id)" :disabled="stoppingTaskIds.has(selectedTask.task_id)" class="text-[11px] px-2 py-1 rounded border border-accent-red/30 text-accent-red hover:bg-accent-red/10 disabled:opacity-40 transition-colors">Cancel</button><button @click="closeTask" class="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors"><svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg></button></div></div><div class="flex-1 overflow-y-auto p-4 space-y-4"><div v-if="detailLoading" class="text-text-muted text-xs text-center py-4">Loading task details...</div><div v-else-if="detailError" class="text-accent-red text-xs">{{ detailError }}</div><div class="flex items-center gap-2"><label class="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer"><input v-model="showActivityDetails" type="checkbox" class="w-3 h-3 accent-accent-cyan rounded" />Show all events</label><span v-if="selectedTask?.completed_at" class="text-[11px] text-text-muted font-mono">Completed {{ formatDateTime(selectedTask.completed_at) }}</span></div><div v-if="activityLoading" class="text-text-muted text-xs text-center py-4">Loading activity...</div><div v-else class="space-y-1"><div v-for="(entry, idx) in summaryActivity" :key="idx" @click="toggleActivityEntry(idx)" class="rounded-md px-3 py-2 bg-bg-card border border-border hover:border-border-bright transition-colors cursor-pointer"><div class="flex items-start gap-2"><span class="text-base shrink-0 mt-0.5">{{ entry.icon }}</span><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span :class="activityKindClass(entry)" class="text-xs flex-1 truncate">{{ entry.summary }}</span><span class="text-[10px] text-text-muted font-mono shrink-0">{{ formatActivityTime(entry.ts) }}</span></div><div v-if="(showActivityDetails || expandedActivity.has(idx)) && entry.detail" class="mt-1.5 text-[11px] text-text-secondary font-mono whitespace-pre-wrap border-t border-border pt-1.5 max-h-40 overflow-y-auto">{{ entry.detail }}</div></div></div></div><div v-if="!summaryActivity.length" class="text-text-muted text-xs text-center py-4">No activity</div></div><div v-if="selectedTask?.result" class="bg-bg-card border border-border rounded-lg p-4"><p class="text-[11px] text-text-muted uppercase tracking-wider mb-2">Result</p><div class="wiki-content text-sm" v-html="renderMarkdown(selectedTask.result)"></div></div></div></template></div></div></div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { apiFetch, authenticatedUrl } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'

interface Agent {
  slug: string
  name: string
  characterName?: string
  roleTitle?: string
  universe?: string
  status: 'idle' | 'working' | 'error'
  currentTask?: string
  currentTaskId?: string
  model?: string
}

interface AgentTask {
  task_id: string
  agent_slug: string
  description: string
  status: string
  result: string | null
  origin_channel: string | null
  started_at: string
  completed_at: string | null
}

const agents = ref<Agent[]>([])

/** Only show agents that are genuinely active (not idle). */
const activeAgents = computed(() => agents.value.filter(a => a.status !== 'idle'))
const tasks = ref<AgentTask[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const stoppingTaskIds = ref<Set<string>>(new Set())

const selectedTaskId = ref<string | null>(null)
const selectedTask = ref<AgentTask | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

interface ActivityEntry {
  ts: number
  kind: 'message' | 'reasoning' | 'tool' | 'outcome' | 'system'
  icon: string
  summary: string
  detail?: string
  rawType: string
  raw: unknown
  toolCallId?: string
  status?: 'pending' | 'success' | 'error'
}

const activity = ref<ActivityEntry[]>([])
const activityLoading = ref(false)
const showActivityDetails = ref(false)
const expandedActivity = ref<Set<number>>(new Set())

/**
 * In the summary view, filter out noise events:
 * - assistant.message events with empty/whitespace content
 * - Successfully completed tool events (status=success, merged start+complete)
 * When "Show details" is checked, all events are shown unfiltered for debugging.
 */
const summaryActivity = computed(() => {
  if (showActivityDetails.value) return activity.value
  return activity.value.filter(entry => {
    if (entry.rawType === 'assistant.message' && (!entry.detail || !entry.detail.trim())) return false
    if (entry.rawType.includes('tool.execution_complete') && entry.status === 'success') return false
    return true
  })
})
let activityEventSource: EventSource | null = null
let activityRefreshTimer: ReturnType<typeof setTimeout> | null = null

let refreshInterval: ReturnType<typeof setInterval> | null = null

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

const formatDateTime = (value: string) => {
  if (!value) return ''
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'running': return 'bg-accent/10 text-accent border border-accent/20'
    case 'done': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    case 'failed': return 'bg-red-500/10 text-red-400 border border-red-500/20'
    case 'cancelled': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    default: return 'bg-surface-3/50 text-txt-muted border border-edge'
  }
}

const taskStatusClass = (status: string) => {
  switch (status) {
    case 'running': return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30'
    case 'done': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/30'
    case 'cancelled': return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    default: return 'bg-bg-elevated text-text-muted border-border'
  }
}

const formatShortTime = (val: string) => {
  if (!val) return ''
  const iso = val.includes('T') ? val : val.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return val
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const durationLabel = computed(() => {
  if (!selectedTask.value) return null
  const start = selectedTask.value.started_at
  const end = selectedTask.value.completed_at
  if (!start || !end) return null
  const startMs = new Date(start.includes('T') ? start : start.replace(' ', 'T') + 'Z').getTime()
  const endMs = new Date(end.includes('T') ? end : end.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000))
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
})

const stopTask = async (taskId: string) => {
  if (stoppingTaskIds.value.has(taskId)) return
  stoppingTaskIds.value = new Set(stoppingTaskIds.value).add(taskId)
  try {
    await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' })
    await refreshAll()
    if (selectedTaskId.value === taskId) {
      await loadTaskDetail(taskId)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to stop task'
  } finally {
    const next = new Set(stoppingTaskIds.value)
    next.delete(taskId)
    stoppingTaskIds.value = next
  }
}

const refreshAgents = async () => {
  try {
    const response = await apiFetch('/api/agents')
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = (await response.json()) as { agents: Agent[] }
    agents.value = data.agents
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load agents'
  }
}

const refreshTasks = async () => {
  try {
    const response = await apiFetch('/api/tasks?limit=50')
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = (await response.json()) as { tasks: AgentTask[] }
    tasks.value = data.tasks
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load tasks'
  }
}

const refreshAll = async () => {
  loading.value = true
  error.value = null
  try {
    await Promise.all([refreshAgents(), refreshTasks()])
  } finally {
    loading.value = false
  }
}

const loadTaskDetail = async (taskId: string) => {
  detailLoading.value = true
  detailError.value = null
  try {
    const response = await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as { task: AgentTask }
    selectedTask.value = data.task
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : 'Failed to load task'
    selectedTask.value = null
  } finally {
    detailLoading.value = false
  }
}

const formatActivityTime = (ts: number) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const formatRaw = (raw: unknown) => {
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}

const activityKindClass = (entry: ActivityEntry) => {
  if (entry.status === 'success') return 'text-emerald-300'
  if (entry.status === 'error') return 'text-red-300'
  if (entry.status === 'pending') return 'text-accent'
  switch (entry.kind) {
    case 'message': return 'text-txt-primary'
    case 'reasoning': return 'text-purple-300'
    case 'tool': return 'text-blue-300'
    case 'outcome': return 'text-amber-300'
    default: return 'text-txt-secondary'
  }
}

const toggleActivityEntry = (idx: number) => {
  if (showActivityDetails.value) return
  const next = new Set(expandedActivity.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  expandedActivity.value = next
}

const loadActivity = async (taskId: string, opts: { initial?: boolean } = {}) => {
  if (opts.initial) activityLoading.value = true
  try {
    const response = await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/activity`)
    if (!response.ok) return
    const data = (await response.json()) as { activity: ActivityEntry[] }
    activity.value = data.activity ?? []
  } catch {
    // Non-fatal
  } finally {
    if (opts.initial) activityLoading.value = false
  }
}

const scheduleActivityRefresh = (taskId: string) => {
  if (activityRefreshTimer) return
  activityRefreshTimer = setTimeout(() => {
    activityRefreshTimer = null
    if (selectedTaskId.value === taskId) loadActivity(taskId)
  }, 250)
}

const startActivityStream = async (taskId: string) => {
  stopActivityStream()
  loadActivity(taskId, { initial: true })
  try {
    activityEventSource = new EventSource(await authenticatedUrl(`/api/tasks/${encodeURIComponent(taskId)}/events`))
    activityEventSource.onmessage = () => {
      scheduleActivityRefresh(taskId)
    }
    activityEventSource.onerror = () => {
      // EventSource auto-reconnects
    }
  } catch {
    activityEventSource = null
  }
}

const stopActivityStream = () => {
  if (activityEventSource) {
    activityEventSource.close()
    activityEventSource = null
  }
  if (activityRefreshTimer) {
    clearTimeout(activityRefreshTimer)
    activityRefreshTimer = null
  }
}

const openTask = (taskId: string) => {
  selectedTaskId.value = taskId
  selectedTask.value = null
  activity.value = []
  expandedActivity.value = new Set()
  loadTaskDetail(taskId)
  startActivityStream(taskId)
}

const closeTask = () => {
  selectedTaskId.value = null
  selectedTask.value = null
  detailError.value = null
  activity.value = []
  expandedActivity.value = new Set()
  stopActivityStream()
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && selectedTaskId.value) closeTask()
}

watch(selectedTaskId, (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})

onMounted(() => {
  refreshAll()
  refreshInterval = setInterval(refreshAll, 5000)
})

watch(
  () => selectedTask.value?.status,
  (status) => {
    if (status && status !== 'running') {
      if (selectedTaskId.value) loadActivity(selectedTaskId.value)
      stopActivityStream()
    }
  }
)

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  document.removeEventListener('keydown', onKeydown)
  stopActivityStream()
})
</script>
