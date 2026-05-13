<template>
  <div class="flex flex-col h-full bg-gray-950">
    <div class="flex-1 overflow-y-auto p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Schedules</h2>
        <button
          @click="fetchSchedules"
          :disabled="loading"
          class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div v-if="loading" class="text-gray-400 text-center py-12">
        Loading schedules...
      </div>

      <div v-else-if="error" class="bg-red-900 text-red-100 p-4 rounded-lg mb-4">
        {{ error }}
      </div>

      <template v-else>
        <!-- IO Schedules -->
        <details open class="mb-6">
          <summary class="cursor-pointer select-none flex items-center gap-2 text-lg font-semibold text-gray-100 mb-4 py-2 border-b border-gray-700">
            <span class="text-gray-400 text-sm">▶</span>
            🤖 IO Schedules
            <span class="ml-2 text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{{ ioSchedules.length }}</span>
          </summary>

          <div v-if="ioSchedules.length === 0" class="text-gray-500 italic text-sm py-4 text-center">
            No IO schedules configured.
          </div>

          <div v-else class="grid gap-3">
            <div
              v-for="s in ioSchedules"
              :key="s.id"
              class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-100">{{ s.name }}</span>
                    <span :class="[
                      'px-2 py-0.5 rounded text-xs font-medium',
                      s.enabled ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-400'
                    ]">
                      {{ s.enabled ? 'Active' : 'Paused' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-4 text-sm text-gray-400 mt-1">
                    <span class="font-mono text-xs bg-gray-900 px-2 py-0.5 rounded">{{ s.cron_expr }}</span>
                    <span title="Next run">⏭ {{ s.next_run_at ? formatDate(s.next_run_at) : '—' }}</span>
                    <span title="Last run">🕐 {{ s.last_run_at ? formatDate(s.last_run_at) : '—' }}</span>
                  </div>
                  <p v-if="s.notes" class="text-xs text-gray-500 mt-1 truncate">{{ s.notes }}</p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    v-if="s.enabled"
                    @click="pauseSchedule('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Pause"
                  >⏸ Pause</button>
                  <button
                    v-else
                    @click="resumeSchedule('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Resume"
                  >▶ Resume</button>
                  <button
                    @click="runNow('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
                    title="Run now"
                  >▶ Run now</button>
                  <button
                    @click="toggleHistory('io', s.id)"
                    :class="[
                      'text-xs px-3 py-1.5 rounded transition-colors',
                      historyOpen.get(`io-${s.id}`)
                        ? 'bg-blue-800 text-blue-200'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    ]"
                    title="Toggle run history"
                  >📋 History</button>
                  <button
                    @click="deleteSchedule('io', s.id, s.name)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Delete"
                  >🗑</button>
                </div>
              </div>

              <!-- Inline history panel -->
              <div v-if="historyOpen.get(`io-${s.id}`)" class="mt-4 pt-4 border-t border-gray-700">
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Run history — {{ s.name }}
                </h4>
                <div v-if="historyLoading.has(`io-${s.id}`)" class="text-gray-500 text-xs py-2 text-center">
                  Loading…
                </div>
                <div v-else-if="!historyData.get(`io-${s.id}`) || historyData.get(`io-${s.id}`)!.length === 0"
                     class="text-gray-500 italic text-xs py-2 text-center">
                  No history yet
                </div>
                <ul v-else class="space-y-2">
                  <li
                    v-for="run in historyData.get(`io-${s.id}`)"
                    :key="run.id"
                    class="flex items-start gap-2 text-xs bg-gray-900 rounded p-2"
                  >
                    <span class="shrink-0 mt-0.5">{{ runIcon(run.status) }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-gray-300">{{ formatDate(run.started_at) }}</span>
                        <span :class="['px-1.5 py-0.5 rounded text-[10px] font-medium', runStatusClass(run.status)]">
                          {{ run.status }}
                        </span>
                      </div>
                      <div v-if="run.completed_at" class="text-gray-500 mt-0.5">
                        Completed: {{ formatDate(run.completed_at) }}
                      </div>
                      <div v-if="run.error_text" class="text-red-400 mt-1 break-words">
                        {{ run.error_text }}
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </details>

        <!-- Squad Schedules -->
        <details open>
          <summary class="cursor-pointer select-none flex items-center gap-2 text-lg font-semibold text-gray-100 mb-4 py-2 border-b border-gray-700">
            <span class="text-gray-400 text-sm">▶</span>
            👥 Squad Schedules
            <span class="ml-2 text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{{ squadSchedules.length }}</span>
          </summary>

          <div v-if="squadSchedules.length === 0" class="text-gray-500 italic text-sm py-4 text-center">
            No squad schedules configured.
          </div>

          <div v-else class="grid gap-3">
            <div
              v-for="s in squadSchedules"
              :key="s.id"
              class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-100">{{ s.name }}</span>
                    <span class="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">{{ s.squad_slug }}</span>
                    <span :class="[
                      'px-2 py-0.5 rounded text-xs font-medium',
                      s.enabled ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-400'
                    ]">
                      {{ s.enabled ? 'Active' : 'Paused' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-4 text-sm text-gray-400 mt-1">
                    <span class="font-mono text-xs bg-gray-900 px-2 py-0.5 rounded">{{ s.cron_expr }}</span>
                    <span title="Next run">⏭ {{ s.next_run_at ? formatDate(s.next_run_at) : '—' }}</span>
                    <span title="Last run">🕐 {{ s.last_run_at ? formatDate(s.last_run_at) : '—' }}</span>
                  </div>
                  <p v-if="s.notes" class="text-xs text-gray-500 mt-1 truncate">{{ s.notes }}</p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    v-if="s.enabled"
                    @click="pauseSchedule('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Pause"
                  >⏸ Pause</button>
                  <button
                    v-else
                    @click="resumeSchedule('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Resume"
                  >▶ Resume</button>
                  <button
                    @click="runNow('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
                    title="Run now"
                  >▶ Run now</button>
                  <button
                    @click="toggleHistory('squads', s.id)"
                    :class="[
                      'text-xs px-3 py-1.5 rounded transition-colors',
                      historyOpen.get(`squads-${s.id}`)
                        ? 'bg-blue-800 text-blue-200'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    ]"
                    title="Toggle run history"
                  >📋 History</button>
                  <button
                    @click="deleteSchedule('squads', s.id, s.name)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 text-xs px-3 py-1.5 rounded transition-colors"
                    title="Delete"
                  >🗑</button>
                </div>
              </div>

              <!-- Inline history panel -->
              <div v-if="historyOpen.get(`squads-${s.id}`)" class="mt-4 pt-4 border-t border-gray-700">
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Run history — {{ s.name }}
                </h4>
                <div v-if="historyLoading.has(`squads-${s.id}`)" class="text-gray-500 text-xs py-2 text-center">
                  Loading…
                </div>
                <div v-else-if="!historyData.get(`squads-${s.id}`) || historyData.get(`squads-${s.id}`)!.length === 0"
                     class="text-gray-500 italic text-xs py-2 text-center">
                  No history yet
                </div>
                <ul v-else class="space-y-2">
                  <li
                    v-for="run in historyData.get(`squads-${s.id}`)"
                    :key="run.id"
                    class="flex items-start gap-2 text-xs bg-gray-900 rounded p-2"
                  >
                    <span class="shrink-0 mt-0.5">{{ runIcon(run.status) }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-gray-300">{{ formatDate(run.started_at) }}</span>
                        <span :class="['px-1.5 py-0.5 rounded text-[10px] font-medium', runStatusClass(run.status)]">
                          {{ run.status }}
                        </span>
                      </div>
                      <div v-if="run.completed_at" class="text-gray-500 mt-0.5">
                        Completed: {{ formatDate(run.completed_at) }}
                      </div>
                      <div v-if="run.error_text" class="text-red-400 mt-1 break-words">
                        {{ run.error_text }}
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </details>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiFetch } from '../lib/api'

interface IoSchedule {
  id: number
  name: string
  cron_expr: string
  prompt: string
  notes: string | null
  enabled: number
  created_at: string
  last_run_at: string | null
  next_run_at: string | null
}

interface SquadSchedule {
  id: number
  squad_slug: string
  name: string
  cron_expr: string
  prompt: string
  notes: string | null
  enabled: number
  created_at: string
  last_run_at: string | null
  next_run_at: string | null
}

interface ScheduleRun {
  id: number
  schedule_type: string
  schedule_id: number
  schedule_name: string
  squad_slug: string | null
  status: string
  error_text: string | null
  notification_id: number | null
  started_at: string
  completed_at: string | null
}

const ioSchedules = ref<IoSchedule[]>([])
const squadSchedules = ref<SquadSchedule[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const mutating = ref(new Set<string>())

const historyOpen = ref(new Map<string, boolean>())
const historyData = ref(new Map<string, ScheduleRun[]>())
const historyLoading = ref(new Set<string>())

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function runIcon(status: string): string {
  if (status === 'done') return '✅'
  if (status === 'failed') return '❌'
  return '⏳'
}

function runStatusClass(status: string): string {
  if (status === 'done') return 'bg-green-900 text-green-200'
  if (status === 'failed') return 'bg-red-900 text-red-200'
  return 'bg-gray-700 text-gray-300'
}

async function toggleHistory(ns: 'io' | 'squads', id: number): Promise<void> {
  const key = `${ns}-${id}`
  const isOpen = historyOpen.value.get(key) ?? false

  // Toggle off
  const nextOpen = new Map(historyOpen.value)
  nextOpen.set(key, !isOpen)
  historyOpen.value = nextOpen

  // Fetch if opening and not yet loaded
  if (!isOpen && !historyData.value.has(key)) {
    const nextLoading = new Set(historyLoading.value)
    nextLoading.add(key)
    historyLoading.value = nextLoading

    try {
      const res = await apiFetch(`/api/schedules/${ns}/${id}/runs?limit=25`)
      if (res.ok) {
        const data = (await res.json()) as { runs: ScheduleRun[] }
        const nextData = new Map(historyData.value)
        nextData.set(key, data.runs ?? [])
        historyData.value = nextData
      }
    } catch { /* best effort */ } finally {
      const next = new Set(historyLoading.value)
      next.delete(key)
      historyLoading.value = next
    }
  }
}

async function fetchSchedules(): Promise<void> {
  loading.value = true
  error.value = null
  // Clear cached history so a refresh picks up new runs
  historyData.value = new Map()
  try {
    const res = await apiFetch('/api/schedules')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { io: IoSchedule[]; squads: SquadSchedule[] }
    ioSchedules.value = data.io
    squadSchedules.value = data.squads
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load schedules'
  } finally {
    loading.value = false
  }
}

async function mutate(key: string, fn: () => Promise<void>): Promise<void> {
  if (mutating.value.has(key)) return
  mutating.value = new Set(mutating.value).add(key)
  try {
    await fn()
    await fetchSchedules()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Action failed'
  } finally {
    const next = new Set(mutating.value)
    next.delete(key)
    mutating.value = next
  }
}

async function pauseSchedule(ns: 'io' | 'squads', id: number): Promise<void> {
  await mutate(`${ns}-${id}`, async () => {
    const res = await apiFetch(`/api/schedules/${ns}/${id}/pause`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

async function resumeSchedule(ns: 'io' | 'squads', id: number): Promise<void> {
  await mutate(`${ns}-${id}`, async () => {
    const res = await apiFetch(`/api/schedules/${ns}/${id}/resume`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

async function runNow(ns: 'io' | 'squads', id: number): Promise<void> {
  await mutate(`${ns}-${id}`, async () => {
    const res = await apiFetch(`/api/schedules/${ns}/${id}/run-now`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

async function deleteSchedule(ns: 'io' | 'squads', id: number, name: string): Promise<void> {
  if (!window.confirm(`Delete schedule '${name}'?`)) return
  await mutate(`${ns}-${id}`, async () => {
    const res = await apiFetch(`/api/schedules/${ns}/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

onMounted(fetchSchedules)
</script>
