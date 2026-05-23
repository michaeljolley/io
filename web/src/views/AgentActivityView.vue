<template>
  <div class="flex flex-col h-full bg-surface-0">
    <div class="flex-1 overflow-y-auto p-3 sm:p-6">
      <div class="max-w-4xl">
        <div class="flex justify-between items-end mb-6">
          <div>
            <h2 class="text-xl font-bold text-txt-primary tracking-tight">Activity</h2>
            <p class="text-xs text-txt-muted mt-0.5">Monitor agents and recent tasks</p>
          </div>
          <button
            @click="refreshAll"
            :disabled="loading"
            class="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150
                   bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 hover:border-accent/40
                   disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>

        <div v-if="error" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-6 text-sm">
          <span>⚠</span> {{ error }}
        </div>

        <!-- ═══ Active Agents ═══ -->
        <section class="mb-8">
          <h3 class="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-3">Active Agents</h3>

          <div v-if="loading && agents.length === 0" class="flex items-center justify-center py-10">
            <div class="flex items-center gap-2 text-txt-muted text-sm">
              <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
              Loading agents…
            </div>
          </div>
          <div v-else-if="agents.length === 0" class="text-txt-muted text-sm text-center py-10">
            No active agents
          </div>
          <div v-else class="grid gap-3">
            <div
              v-for="agent in agents"
              :key="agent.slug + (agent.characterName || '')"
              class="group bg-surface-2/40 border rounded-xl p-4 transition-all duration-200"
              :class="agent.status === 'working'
                ? 'border-accent/20 hover:border-accent/35'
                : 'border-edge hover:border-edge-bright'"
            >
              <div class="flex justify-between items-start mb-2.5">
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Agent avatar -->
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                    :class="agent.status === 'working'
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : agent.status === 'error'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'"
                  >
                    {{ (agent.name ?? '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <h3 class="font-semibold text-txt-primary text-sm">{{ agent.name }}</h3>
                    <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span class="text-[10px] text-txt-muted font-mono">{{ agent.slug }}</span>
                      <span v-if="agent.roleTitle" class="text-[10px] text-txt-secondary bg-surface-3/50 px-1.5 py-0.5 rounded border border-edge">
                        {{ agent.roleTitle }}
                      </span>
                      <span v-if="agent.universe" class="text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        🎬 {{ agent.universe }}
                      </span>
                      <span
                        v-if="agent.model && agent.status === 'working'"
                        class="text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                        :title="`Model: ${agent.model}`"
                      >
                        🧠 {{ agent.model }}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                  :class="agent.status === 'working'
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : agent.status === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'"
                >
                  <span class="w-1.5 h-1.5 rounded-full"
                    :class="agent.status === 'working' ? 'bg-accent animate-pulse' : agent.status === 'error' ? 'bg-red-400' : 'bg-emerald-400'"
                  ></span>
                  {{ agent.status === 'working' ? 'Working' : agent.status === 'error' ? 'Error' : 'Idle' }}
                </span>
              </div>

              <div v-if="agent.currentTask" class="bg-surface-0/60 border border-edge rounded-lg p-3 mb-2.5 ml-12">
                <p class="text-[10px] text-txt-muted uppercase tracking-wider mb-1">Current Task</p>
                <p class="text-sm text-txt-primary break-words">{{ agent.currentTask }}</p>
              </div>

              <div class="flex justify-between items-center ml-12">
                <div class="text-[10px] text-txt-muted">
                  Last updated: {{ formatTime(new Date()) }}
                </div>
                <button
                  v-if="agent.status === 'working' && agent.currentTaskId"
                  type="button"
                  @click="stopTask(agent.currentTaskId)"
                  :disabled="stoppingTaskIds.has(agent.currentTaskId)"
                  class="text-[10px] font-medium px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20
                         hover:bg-red-500/20 disabled:opacity-40 transition-all duration-150 flex items-center gap-1"
                  title="Stop task"
                >
                  <span class="w-2 h-2 rounded-[2px] bg-red-400"></span>
                  {{ stoppingTaskIds.has(agent.currentTaskId) ? 'Stopping…' : 'Stop' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ Recent Activity Timeline ═══ -->
        <section>
          <h3 class="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-3">Recent Activity</h3>

          <div v-if="loading && tasks.length === 0" class="flex items-center justify-center py-10">
            <div class="flex items-center gap-2 text-txt-muted text-sm">
              <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
              Loading activity…
            </div>
          </div>
          <div v-else-if="tasks.length === 0" class="text-txt-muted text-sm text-center py-10">
            No recent activity yet
          </div>

          <!-- Timeline -->
          <div v-else class="relative">
            <!-- Vertical timeline line -->
            <div class="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-accent/30 via-edge to-transparent"></div>

            <div class="space-y-1">
              <button
                v-for="task in tasks"
                :key="task.task_id"
                type="button"
                @click="openTask(task.task_id)"
                class="w-full text-left relative pl-10 pr-4 py-3 rounded-lg
                       hover:bg-surface-2/40 transition-all duration-150 group"
              >
                <!-- Timeline dot -->
                <div
                  class="absolute left-[11px] top-4 w-[9px] h-[9px] rounded-full border-2 z-10"
                  :class="task.status === 'running'
                    ? 'bg-accent border-accent shadow-glow-sm'
                    : task.status === 'done'
                      ? 'bg-emerald-400 border-emerald-400'
                      : task.status === 'failed'
                        ? 'bg-red-400 border-red-400'
                        : task.status === 'cancelled'
                          ? 'bg-amber-400 border-amber-400'
                          : 'bg-surface-3 border-edge'"
                ></div>

                <div class="flex justify-between items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm font-medium text-txt-primary truncate group-hover:text-accent transition-colors">{{ task.agent_slug }}</span>
                      <span v-if="task.origin_channel" class="text-[10px] text-txt-muted bg-surface-3/40 px-1.5 py-0.5 rounded border border-edge">via {{ task.origin_channel }}</span>
                    </div>
                    <p class="text-xs text-txt-secondary truncate">{{ task.description }}</p>
                    <p class="text-[10px] text-txt-muted mt-1">
                      {{ formatDateTime(task.started_at) }}
                      <span v-if="task.completed_at"> · {{ formatDateTime(task.completed_at) }}</span>
                    </p>
                  </div>
                  <span
                    class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                    :class="statusBadgeClass(task.status)"
                  >
                    <span v-if="task.status === 'running'" class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                    {{ task.status }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ═══ Task Detail Modal ═══ -->
    <div
      v-if="selectedTaskId"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="closeTask"
    >
      <div class="bg-surface-1 border border-edge rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
        <div class="flex justify-between items-center px-5 py-3.5 border-b border-edge">
          <h3 class="text-sm font-semibold text-txt-primary">Task Details</h3>
          <button
            type="button"
            @click="closeTask"
            class="text-txt-muted hover:text-txt-primary text-lg leading-none transition-colors p-1"
            aria-label="Close"
          >×</button>
        </div>

        <div class="overflow-y-auto p-5 space-y-4">
          <div v-if="detailLoading" class="flex items-center justify-center py-10">
            <div class="flex items-center gap-2 text-txt-muted text-sm">
              <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
              Loading task…
            </div>
          </div>
          <div v-else-if="detailError" class="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg text-sm">
            {{ detailError }}
          </div>
          <template v-else-if="selectedTask">
            <div class="flex justify-between items-start gap-3">
              <div>
                <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Agent</p>
                <p class="text-sm text-txt-primary font-medium">{{ selectedTask.agent_slug }}</p>
              </div>
              <span :class="['flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium', statusBadgeClass(selectedTask.status)]">
                <span v-if="selectedTask.status === 'running'" class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                {{ selectedTask.status }}
              </span>
            </div>

            <div>
              <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Task ID</p>
              <p class="text-[11px] text-txt-muted font-mono break-all bg-surface-0/60 px-2 py-1 rounded border border-edge">{{ selectedTask.task_id }}</p>
            </div>

            <div v-if="selectedTask.origin_channel">
              <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Origin</p>
              <p class="text-sm text-txt-secondary">{{ selectedTask.origin_channel }}</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Started</p>
                <p class="text-sm text-txt-secondary">{{ formatDateTime(selectedTask.started_at) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Completed</p>
                <p class="text-sm text-txt-secondary">
                  {{ selectedTask.completed_at ? formatDateTime(selectedTask.completed_at) : '—' }}
                </p>
              </div>
            </div>

            <div v-if="durationLabel">
              <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Duration</p>
              <p class="text-sm text-accent font-mono">{{ durationLabel }}</p>
            </div>

            <div>
              <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Description</p>
              <div class="text-sm text-txt-primary bg-surface-0/60 border border-edge rounded-lg p-3 wiki-content" v-html="renderMarkdown(selectedTask.description)"></div>
            </div>

            <div>
              <div class="flex justify-between items-center mb-2">
                <p class="text-[10px] uppercase tracking-widest text-txt-muted">Activity</p>
                <label class="flex items-center gap-1.5 text-[10px] text-txt-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    v-model="showActivityDetails"
                    class="rounded bg-surface-3 border-edge accent-accent"
                  />
                  Show details
                </label>
              </div>
              <div
                v-if="activityLoading && activity.length === 0"
                class="text-sm text-txt-muted italic"
              >Loading activity…</div>
              <div
                v-else-if="activity.length === 0"
                class="text-sm text-txt-muted italic"
              >No activity yet</div>
              <ul
                v-else
                class="bg-surface-0/60 border border-edge rounded-lg divide-y divide-edge max-h-96 overflow-y-auto"
              >
                <li
                  v-for="(entry, idx) in summaryActivity"
                  :key="`${entry.ts}-${idx}-${entry.rawType}`"
                  class="px-3 py-2 text-sm hover:bg-surface-2/40 cursor-pointer transition-colors"
                  @click="toggleActivityEntry(idx)"
                >
                  <div class="flex items-start gap-2" :class="activityKindClass(entry)">
                    <span class="shrink-0">{{ entry.icon }}</span>
                    <span class="flex-1 break-words">{{ entry.summary }}</span>
                    <span class="text-[10px] text-txt-muted shrink-0">
                      {{ formatActivityTime(entry.ts) }}
                    </span>
                  </div>
                  <div
                    v-if="showActivityDetails || expandedActivity.has(idx)"
                    class="mt-2 pl-6 space-y-1"
                  >
                    <pre
                      v-if="entry.detail"
                      class="text-xs text-txt-secondary bg-surface-1 border border-edge rounded-lg p-2 whitespace-pre-wrap break-words font-mono"
                    >{{ entry.detail }}</pre>
                    <pre
                      class="text-[11px] text-txt-muted bg-surface-1 border border-edge rounded-lg p-2 whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto"
                    >{{ formatRaw(entry.raw) }}</pre>
                    <p class="text-[10px] text-txt-muted font-mono">{{ entry.rawType }}</p>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <p class="text-[10px] uppercase tracking-widest text-txt-muted mb-0.5">Result</p>
              <div v-if="selectedTask.result" class="text-sm text-txt-primary bg-surface-0/60 border border-edge rounded-lg p-3 wiki-content max-h-96 overflow-y-auto" v-html="renderMarkdown(selectedTask.result)"></div>
              <p v-else class="text-sm text-txt-muted italic">No result yet</p>
            </div>
          </template>
        </div>

        <div class="px-5 py-3 border-t border-edge flex justify-between items-center">
          <button
            v-if="selectedTask && selectedTask.status === 'running'"
            type="button"
            @click="stopTask(selectedTask.task_id)"
            :disabled="stoppingTaskIds.has(selectedTask.task_id)"
            class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20
                   hover:bg-red-500/20 disabled:opacity-40 transition-all duration-150"
          >
            {{ stoppingTaskIds.has(selectedTask.task_id) ? 'Stopping…' : 'Stop Task' }}
          </button>
          <span v-else></span>
          <button
            type="button"
            @click="closeTask"
            class="bg-surface-3/50 hover:bg-surface-3/70 text-txt-secondary text-sm px-4 py-1.5 rounded-lg border border-edge transition-all duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
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

<style scoped>
</style>
