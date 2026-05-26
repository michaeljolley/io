<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatRelativeTime } from '@/lib/mission-control'

type Schedule = {
  id: string | number
  name: string
  cron_expr: string
  prompt: string
  enabled: boolean
  last_run_at?: string | null
  next_run_at?: string | null
  squad_slug?: string
}

type ScheduleRun = {
  id: string | number
  status: string
  started_at: string
  completed_at?: string | null
  error_text?: string | null
}

const scope = ref<'io' | 'squads'>('io')
const schedules = ref<{ io: Schedule[]; squads: Schedule[] }>({ io: [], squads: [] })
const selectedId = ref('')
const runs = ref<ScheduleRun[]>([])

const activeSchedules = computed(() => schedules.value[scope.value])
const selected = computed(() => activeSchedules.value.find((item) => String(item.id) === selectedId.value) ?? null)

async function loadSchedules() {
  const response = await apiFetch('/api/schedules')
  if (!response.ok) return
  schedules.value = await response.json() as { io: Schedule[]; squads: Schedule[] }
  if (!selectedId.value && activeSchedules.value[0]) {
    selectedId.value = String(activeSchedules.value[0].id)
    await loadRuns()
  }
}

async function loadRuns() {
  if (!selected.value) {
    runs.value = []
    return
  }
  const response = await apiFetch(`/api/schedules/${scope.value}/${selected.value.id}/runs`)
  if (!response.ok) return
  runs.value = (await response.json() as { runs: ScheduleRun[] }).runs
}

async function action(actionName: 'pause' | 'resume' | 'run-now') {
  if (!selected.value) return
  await apiFetch(`/api/schedules/${scope.value}/${selected.value.id}/${actionName}`, { method: 'POST' })
  await Promise.all([loadSchedules(), loadRuns()])
}

async function removeSchedule() {
  if (!selected.value) return
  await apiFetch(`/api/schedules/${scope.value}/${selected.value.id}`, { method: 'DELETE' })
  selectedId.value = ''
  runs.value = []
  await loadSchedules()
}

async function switchScope(nextScope: 'io' | 'squads') {
  scope.value = nextScope
  selectedId.value = String(schedules.value[nextScope][0]?.id ?? '')
  await loadRuns()
}

onMounted(loadSchedules)
</script>

<template>
  <div class="grid h-full min-h-0 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section class="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
      <div class="border-b border-border px-5 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Schedule Matrix</div>
            <div class="mt-3 flex gap-2">
              <button class="rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em]" :class="scope === 'io' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'" @click="switchScope('io')">IO</button>
              <button class="rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em]" :class="scope === 'squads' ? 'border-accent-foreground/40 bg-accent-foreground/10 text-accent-foreground' : 'border-border text-muted-foreground'" @click="switchScope('squads')">Squads</button>
            </div>
          </div>
          <button class="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" @click="loadSchedules">refresh</button>
        </div>
      </div>

      <div class="min-h-0 overflow-y-auto px-4 py-4">
        <div class="space-y-3">
          <button v-for="schedule in activeSchedules" :key="schedule.id" class="grid w-full gap-3 rounded-lg border px-4 py-4 text-left transition-colors lg:grid-cols-[160px_minmax(0,1fr)_170px]" :class="selectedId === String(schedule.id) ? 'border-primary/40 bg-primary/8' : 'border-border bg-sidebar/40 hover:bg-white/[0.03]'" @click="selectedId = String(schedule.id); loadRuns()">
            <div>
              <div class="font-mono text-lg text-primary">{{ schedule.cron_expr }}</div>
              <div class="mt-1 font-mono text-[10px] uppercase tracking-[0.18em]" :class="schedule.enabled ? 'text-status-success' : 'text-destructive'">{{ schedule.enabled ? 'enabled' : 'paused' }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">{{ schedule.name }}</div>
              <div class="mt-2 text-sm leading-6 text-foreground/65">{{ schedule.prompt }}</div>
            </div>
            <div class="font-mono text-xs text-muted-foreground/65">
              <div>last {{ schedule.last_run_at ? formatRelativeTime(schedule.last_run_at) : '—' }}</div>
              <div class="mt-2">next {{ schedule.next_run_at ? formatRelativeTime(schedule.next_run_at) : '—' }}</div>
              <div v-if="schedule.squad_slug" class="mt-2 text-accent-foreground">{{ schedule.squad_slug }}</div>
            </div>
          </button>
          <div v-if="!activeSchedules.length" class="rounded-lg border border-dashed border-border px-4 py-16 text-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/45">No schedules in this scope</div>
        </div>
      </div>
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="border-b border-border px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-foreground">Run Inspector</div>
        <div class="mt-2 text-lg font-semibold">{{ selected?.name ?? 'Select a schedule' }}</div>
      </div>

      <div v-if="selected" class="border-b border-border px-5 py-4">
        <div class="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.16em]">
          <button class="rounded border border-border bg-sidebar px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary" @click="action(selected.enabled ? 'pause' : 'resume')">{{ selected.enabled ? 'pause' : 'resume' }}</button>
          <button class="rounded border border-primary/40 bg-primary/10 px-3 py-2 text-primary" @click="action('run-now')">run now</button>
          <button class="col-span-2 rounded border border-destructive/40 px-3 py-2 text-destructive transition-colors hover:bg-destructive/10" @click="removeSchedule">delete</button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="space-y-3">
          <article v-for="run in runs" :key="run.id" class="rounded-lg border border-white/[0.06] bg-sidebar/60 px-4 py-4">
            <div class="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-[0.16em]">
              <span :class="run.status === 'success' ? 'text-status-success' : run.status === 'error' ? 'text-destructive' : 'text-primary'">{{ run.status }}</span>
              <span class="text-muted-foreground/55">{{ run.id }}</span>
            </div>
            <div class="mt-3 text-sm text-foreground/75">started {{ formatRelativeTime(run.started_at) }}</div>
            <div class="mt-1 text-sm text-foreground/55">completed {{ run.completed_at ? formatRelativeTime(run.completed_at) : '—' }}</div>
            <div v-if="run.error_text" class="mt-3 rounded border border-destructive/25 bg-destructive/10 px-3 py-3 text-sm text-destructive">{{ run.error_text }}</div>
          </article>
          <div v-if="selected && !runs.length" class="rounded-lg border border-dashed border-border px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/45">No run history yet</div>
        </div>
      </div>
    </section>
  </div>
</template>
