<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type Schedule = {
  id: string | number
  name: string
  cron_expr: string
  prompt: string
  notes?: string
  enabled: boolean
  created_at: string
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
const selectedId = ref<string>('')
const runs = ref<ScheduleRun[]>([])

const activeSchedules = computed(() => schedules.value[scope.value])
const selected = computed(() => activeSchedules.value.find((item) => String(item.id) === selectedId.value) ?? null)

async function loadSchedules() {
  const response = await apiFetch('/api/schedules')
  if (response.ok) {
    schedules.value = await response.json() as { io: Schedule[]; squads: Schedule[] }
    if (!selectedId.value && activeSchedules.value[0]) {
      selectedId.value = String(activeSchedules.value[0].id)
      await loadRuns()
    }
  }
}

async function loadRuns() {
  if (!selected.value) {
    runs.value = []
    return
  }
  const response = await apiFetch(`/api/schedules/${scope.value}/${selected.value.id}/runs`)
  if (response.ok) {
    runs.value = (await response.json() as { runs: ScheduleRun[] }).runs
  }
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

onMounted(loadSchedules)
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section class="min-h-0 overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
      <div class="border-b border-line px-5 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">schedule matrix</div>
            <div class="mt-2 flex gap-2">
              <button class="rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" :class="scope === 'io' ? 'border-cyan bg-cyan/10 text-cyan' : 'border-line text-mist'" @click="scope = 'io'; selectedId = String(schedules.io[0]?.id ?? ''); loadRuns()">io</button>
              <button class="rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" :class="scope === 'squads' ? 'border-violet bg-violet/10 text-violet' : 'border-line text-mist'" @click="scope = 'squads'; selectedId = String(schedules.squads[0]?.id ?? ''); loadRuns()">squads</button>
            </div>
          </div>
          <button class="rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-mist transition hover:border-cyan hover:text-cyan" @click="loadSchedules">refresh</button>
        </div>
      </div>
      <div class="min-h-0 overflow-y-auto px-4 py-4">
        <div class="space-y-3">
          <button
            v-for="schedule in activeSchedules"
            :key="schedule.id"
            class="grid w-full items-center gap-3 rounded-[24px] border px-4 py-4 text-left transition lg:grid-cols-[180px_minmax(0,1fr)_220px]"
            :class="selectedId === String(schedule.id) ? 'border-cyan bg-cyan/8' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
            @click="selectedId = String(schedule.id); loadRuns()"
          >
            <div>
              <div class="font-mono text-xl text-cyan">{{ schedule.cron_expr }}</div>
              <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em]" :class="schedule.enabled ? 'text-success' : 'text-danger'">{{ schedule.enabled ? 'enabled' : 'paused' }}</div>
            </div>
            <div>
              <div class="text-sm font-medium text-white">{{ schedule.name }}</div>
              <div class="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{{ schedule.prompt }}</div>
            </div>
            <div class="font-mono text-xs text-mist">
              <div>last {{ schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : '—' }}</div>
              <div class="mt-2">next {{ schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : '—' }}</div>
              <div v-if="schedule.squad_slug" class="mt-2 text-violet">{{ schedule.squad_slug }}</div>
            </div>
          </button>
          <div v-if="!activeSchedules.length" class="rounded-[24px] border border-dashed border-line px-4 py-16 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no schedules in this scope</div>
        </div>
      </div>
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-violet/35 bg-surface/95 shadow-violet">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">run inspector</div>
        <div class="mt-2 text-2xl font-semibold text-white">{{ selected?.name ?? 'Select a schedule' }}</div>
      </div>
      <div class="border-b border-line px-5 py-4" v-if="selected">
        <div class="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">
          <button class="rounded-2xl border border-line bg-panel px-3 py-3 transition hover:border-cyan hover:text-cyan" @click="action(selected.enabled ? 'pause' : 'resume')">{{ selected.enabled ? 'pause' : 'resume' }}</button>
          <button class="rounded-2xl border border-cyan/40 bg-cyan/10 px-3 py-3 text-cyan" @click="action('run-now')">run now</button>
          <button class="col-span-2 rounded-2xl border border-danger/40 px-3 py-3 text-danger" @click="removeSchedule">delete</button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="space-y-3">
          <article v-for="run in runs" :key="run.id" class="rounded-[22px] border border-line bg-panel px-4 py-4">
            <div class="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-[0.18em]">
              <span :class="run.status === 'success' ? 'text-success' : run.status === 'error' ? 'text-danger' : 'text-cyan'">{{ run.status }}</span>
              <span class="text-mist">{{ run.id }}</span>
            </div>
            <div class="mt-3 text-sm text-slate-200">started {{ new Date(run.started_at).toLocaleString() }}</div>
            <div class="mt-1 text-sm text-slate-300">completed {{ run.completed_at ? new Date(run.completed_at).toLocaleString() : '—' }}</div>
            <div v-if="run.error_text" class="mt-3 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-danger">{{ run.error_text }}</div>
          </article>
          <div v-if="selected && !runs.length" class="rounded-[22px] border border-dashed border-line px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no run history yet</div>
        </div>
      </div>
    </section>
  </div>
</template>
