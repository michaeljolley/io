<template>
  <div class="p-5 space-y-5">
    <h1 class="text-base font-semibold text-text">Schedules</h1>
    <div v-if="loading" class="py-12 text-center text-text-muted text-sm">Loading...</div>
    <div v-else-if="error" class="text-accent-red text-sm">{{ error }}</div>
    <template v-else>
      <section v-if="ioSchedules.length" class="space-y-2"><h2 class="text-[11px] text-text-muted uppercase tracking-wider font-medium">IO Schedules</h2><div v-for="s in ioSchedules" :key="s.id" class="bg-bg-card border border-border rounded-lg p-4 space-y-3"><div class="flex items-start justify-between gap-3"><div class="flex items-center gap-2.5 min-w-0"><span :class="s.enabled ? 'bg-accent-green' : 'bg-text-muted/40'" class="w-2 h-2 rounded-full shrink-0 mt-0.5"></span><div class="min-w-0"><p class="text-sm text-text font-medium truncate">{{ s.name }}</p><div class="flex items-center gap-2 mt-0.5"><code class="text-[10px] font-mono text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">{{ s.cron_expr }}</code></div></div></div></div><div v-if="s.last_run_at || s.next_run_at" class="flex items-center gap-3 text-[11px] text-text-muted flex-wrap"><span v-if="s.last_run_at">Last: {{ formatDate(s.last_run_at) }}</span><span v-if="s.next_run_at">Next: {{ formatDate(s.next_run_at) }}</span></div><div><button @click="togglePrompt('io', s.id)" class="text-[11px] text-text-muted hover:text-text transition-colors">{{ promptExpanded.has(`io-${s.id}`) ? '▾ Hide prompt' : '▸ Show prompt' }}</button><pre v-if="promptExpanded.has(`io-${s.id}`)" class="mt-2 text-[11px] font-mono text-text-secondary bg-bg-elevated border border-border rounded p-3 whitespace-pre-wrap max-h-28 overflow-y-auto">{{ s.prompt }}</pre></div><div class="flex items-center gap-2 flex-wrap"><button @click="runNow('io', s.id)" :disabled="mutating.has(`io-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-40 transition-colors">Run now</button><button @click="s.enabled ? pauseSchedule('io', s.id) : resumeSchedule('io', s.id)" :disabled="mutating.has(`io-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated disabled:opacity-40 transition-colors">{{ s.enabled ? 'Pause' : 'Resume' }}</button><button @click="deleteSchedule('io', s.id, s.name)" :disabled="mutating.has(`io-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-accent-red/30 text-accent-red hover:bg-accent-red/10 disabled:opacity-40 transition-colors">Delete</button><button @click="toggleHistory('io', s.id)" class="text-[11px] px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated transition-colors">History</button></div><div v-if="historyOpen.get(`io-${s.id}`)" class="border-t border-border pt-3 space-y-1"><p v-if="historyLoading.has(`io-${s.id}`)" class="text-[11px] text-text-muted">Loading...</p><p v-else-if="!(historyData.get(`io-${s.id}`) ?? []).length" class="text-[11px] text-text-muted">No runs recorded</p><div v-else v-for="run in historyData.get(`io-${s.id}`) ?? []" :key="run.id" class="flex items-center gap-2 text-[11px]"><span :class="runDotClass(run.status)" class="w-1.5 h-1.5 rounded-full shrink-0"></span><span :class="runStatusClass(run.status)" class="font-mono px-1.5 py-0.5 rounded border">{{ run.status }}</span><span class="text-text-muted">{{ formatDate(run.started_at) }}</span><span v-if="run.error_text" class="text-accent-red truncate">{{ run.error_text }}</span></div></div></div></section>
      <section v-if="squadSchedules.length" class="space-y-2"><h2 class="text-[11px] text-text-muted uppercase tracking-wider font-medium">Squad Schedules</h2><div v-for="s in squadSchedules" :key="s.id" class="bg-bg-card border border-border rounded-lg p-4 space-y-3"><div class="flex items-start justify-between gap-3"><div class="flex items-center gap-2.5 min-w-0"><span :class="s.enabled ? 'bg-accent-green' : 'bg-text-muted/40'" class="w-2 h-2 rounded-full shrink-0 mt-0.5"></span><div class="min-w-0"><p class="text-sm text-text font-medium truncate">{{ s.name }}</p><div class="flex items-center gap-2 mt-0.5 flex-wrap"><code class="text-[10px] font-mono text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">{{ s.cron_expr }}</code><span class="text-[10px] font-mono text-accent-purple bg-accent-purple/10 px-1.5 py-0.5 rounded border border-accent-purple/20">{{ s.squad_slug }}</span></div></div></div></div><div v-if="s.last_run_at || s.next_run_at" class="flex items-center gap-3 text-[11px] text-text-muted flex-wrap"><span v-if="s.last_run_at">Last: {{ formatDate(s.last_run_at) }}</span><span v-if="s.next_run_at">Next: {{ formatDate(s.next_run_at) }}</span></div><div><button @click="togglePrompt('squads', s.id)" class="text-[11px] text-text-muted hover:text-text transition-colors">{{ promptExpanded.has(`squads-${s.id}`) ? '▾ Hide prompt' : '▸ Show prompt' }}</button><pre v-if="promptExpanded.has(`squads-${s.id}`)" class="mt-2 text-[11px] font-mono text-text-secondary bg-bg-elevated border border-border rounded p-3 whitespace-pre-wrap max-h-28 overflow-y-auto">{{ s.prompt }}</pre></div><div class="flex items-center gap-2 flex-wrap"><button @click="runNow('squads', s.id)" :disabled="mutating.has(`squads-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-40 transition-colors">Run now</button><button @click="s.enabled ? pauseSchedule('squads', s.id) : resumeSchedule('squads', s.id)" :disabled="mutating.has(`squads-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated disabled:opacity-40 transition-colors">{{ s.enabled ? 'Pause' : 'Resume' }}</button><button @click="deleteSchedule('squads', s.id, s.name)" :disabled="mutating.has(`squads-${s.id}`)" class="text-[11px] px-2.5 py-1 rounded-md border border-accent-red/30 text-accent-red hover:bg-accent-red/10 disabled:opacity-40 transition-colors">Delete</button><button @click="toggleHistory('squads', s.id)" class="text-[11px] px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated transition-colors">History</button></div><div v-if="historyOpen.get(`squads-${s.id}`)" class="border-t border-border pt-3 space-y-1"><p v-if="historyLoading.has(`squads-${s.id}`)" class="text-[11px] text-text-muted">Loading...</p><p v-else-if="!(historyData.get(`squads-${s.id}`) ?? []).length" class="text-[11px] text-text-muted">No runs recorded</p><div v-else v-for="run in historyData.get(`squads-${s.id}`) ?? []" :key="run.id" class="flex items-center gap-2 text-[11px]"><span :class="runDotClass(run.status)" class="w-1.5 h-1.5 rounded-full shrink-0"></span><span :class="runStatusClass(run.status)" class="font-mono px-1.5 py-0.5 rounded border">{{ run.status }}</span><span class="text-text-muted">{{ formatDate(run.started_at) }}</span><span v-if="run.error_text" class="text-accent-red truncate">{{ run.error_text }}</span></div></div></div></section>
      <p v-if="!ioSchedules.length && !squadSchedules.length" class="py-12 text-center text-text-muted text-sm">No schedules configured</p>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
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
const promptExpanded = ref(new Set<string>())

function formatDate(iso: string): string {
  const normalized = iso.includes('T') || iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z'
  return new Date(normalized).toLocaleString()
}

function runDotClass(status: string): string {
  if (status === 'done') return 'bg-emerald-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-accent animate-pulse'
}

function runStatusClass(status: string): string {
  if (status === 'done') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (status === 'failed') return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-accent/10 text-accent border-accent/20'
}

function togglePrompt(ns: 'io' | 'squads', id: number): void {
  const key = `${ns}-${id}`
  const next = new Set(promptExpanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  promptExpanded.value = next
}

async function toggleHistory(ns: 'io' | 'squads', id: number): Promise<void> {
  const key = `${ns}-${id}`
  const isOpen = historyOpen.value.get(key) ?? false

  const nextOpen = new Map(historyOpen.value)
  nextOpen.set(key, !isOpen)
  historyOpen.value = nextOpen

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
