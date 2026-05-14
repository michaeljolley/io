<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-xl font-semibold text-txt-primary tracking-tight">Schedules</h2>
          <p class="text-xs text-txt-muted mt-0.5">Automated tasks &amp; cron jobs</p>
        </div>
        <button
          @click="fetchSchedules"
          :disabled="loading"
          class="flex items-center gap-1.5 bg-surface-2/60 hover:bg-surface-3/60 disabled:opacity-50 text-txt-secondary hover:text-txt-primary border border-edge hover:border-edge-bright px-3.5 py-2 rounded-xl text-sm transition-all duration-200"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/>
          </svg>
          Refresh
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="flex items-center gap-3 text-txt-muted text-sm">
          <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
          Loading schedules…
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4 text-sm">
        {{ error }}
      </div>

      <template v-else>
        <!-- IO Schedules -->
        <details open class="mb-8 group/section">
          <summary class="cursor-pointer select-none flex items-center gap-3 text-sm font-semibold text-txt-primary mb-4 py-2">
            <svg class="w-4 h-4 text-accent transition-transform group-open/section:rotate-90" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>
            <span class="tracking-wide uppercase text-xs text-txt-secondary">IO Schedules</span>
            <span class="text-[10px] font-mono text-txt-muted bg-surface-2 px-2 py-0.5 rounded-full border border-edge">{{ ioSchedules.length }}</span>
            <div class="flex-1 h-px bg-gradient-to-r from-edge to-transparent"></div>
          </summary>

          <div v-if="ioSchedules.length === 0" class="flex flex-col items-center py-8">
            <div class="w-10 h-10 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p class="text-txt-muted text-sm">No IO schedules configured</p>
          </div>

          <div v-else class="grid gap-3">
            <div
              v-for="s in ioSchedules"
              :key="s.id"
              class="bg-surface-2/50 border border-edge rounded-xl p-4 hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden"
            >
              <!-- Top row -->
              <div class="flex flex-wrap items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2 mb-1.5">
                    <span class="font-semibold text-txt-primary break-words min-w-0">{{ s.name }}</span>
                    <span :class="[
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase border shrink-0',
                      s.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-surface-3/60 text-txt-muted border-edge'
                    ]">
                      <span v-if="s.enabled" class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {{ s.enabled ? 'Active' : 'Paused' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-txt-muted mt-1">
                    <code class="font-mono text-accent/80 bg-surface-0/60 px-2 py-0.5 rounded-lg border border-edge/50 break-all">{{ s.cron_expr }}</code>
                    <span v-if="s.next_run_at" class="flex items-center gap-1 shrink-0">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.69z"/></svg>
                      {{ formatDate(s.next_run_at) }}
                    </span>
                    <span v-if="s.last_run_at" class="flex items-center gap-1 shrink-0">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {{ formatDate(s.last_run_at) }}
                    </span>
                  </div>
                  <p v-if="s.notes" class="text-xs text-txt-muted mt-1.5 break-words">{{ s.notes }}</p>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    v-if="s.enabled"
                    @click="pauseSchedule('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="text-txt-secondary hover:text-txt-primary disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-surface-3/40 hover:bg-surface-3 border border-edge/50 hover:border-edge transition-all duration-200"
                    title="Pause"
                  >⏸ Pause</button>
                  <button
                    v-else
                    @click="resumeSchedule('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="text-txt-secondary hover:text-txt-primary disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-surface-3/40 hover:bg-surface-3 border border-edge/50 hover:border-edge transition-all duration-200"
                    title="Resume"
                  >▶ Resume</button>
                  <button
                    @click="runNow('io', s.id)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="text-accent hover:text-white disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 hover:border-accent/40 transition-all duration-200"
                    title="Run now"
                  >▶ Run now</button>
                  <button
                    @click="toggleHistory('io', s.id)"
                    :class="[
                      'text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200',
                      historyOpen.get(`io-${s.id}`)
                        ? 'bg-accent/10 text-accent border-accent/20'
                        : 'bg-surface-3/40 hover:bg-surface-3 text-txt-secondary hover:text-txt-primary border-edge/50 hover:border-edge'
                    ]"
                    title="Toggle run history"
                  >📋 History</button>
                  <button
                    @click="deleteSchedule('io', s.id, s.name)"
                    :disabled="mutating.has(`io-${s.id}`)"
                    class="text-red-400/70 hover:text-red-400 disabled:opacity-50 text-xs px-2 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                    title="Delete"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                  </button>
                </div>
              </div>

              <!-- Prompt -->
              <div v-if="s.prompt" class="mt-3">
                <p class="text-xs text-txt-muted break-words" :class="promptExpanded.has(`io-${s.id}`) ? '' : 'line-clamp-2'">
                  {{ s.prompt }}
                </p>
                <button
                  v-if="s.prompt.length > 120"
                  @click="togglePrompt('io', s.id)"
                  class="text-[10px] text-accent/70 hover:text-accent mt-1 transition-colors"
                >
                  {{ promptExpanded.has(`io-${s.id}`) ? 'Show less ▲' : 'Show more ▼' }}
                </button>
              </div>

              <!-- History panel -->
              <div v-if="historyOpen.get(`io-${s.id}`)" class="mt-4 pt-4 border-t border-edge/50">
                <h4 class="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-3">
                  Run history — {{ s.name }}
                </h4>
                <div v-if="historyLoading.has(`io-${s.id}`)" class="flex items-center gap-2 text-txt-muted text-xs py-2 justify-center">
                  <div class="w-1 h-1 rounded-full bg-accent animate-pulse"></div>
                  Loading…
                </div>
                <div v-else-if="!historyData.get(`io-${s.id}`) || historyData.get(`io-${s.id}`)!.length === 0"
                     class="text-txt-muted text-xs py-2 text-center">
                  No history yet
                </div>
                <ul v-else class="space-y-1.5">
                  <li
                    v-for="run in historyData.get(`io-${s.id}`)"
                    :key="run.id"
                    class="flex items-start gap-2.5 text-xs bg-surface-0/50 rounded-lg p-2.5 border border-edge/30"
                  >
                    <span :class="['w-2 h-2 rounded-full mt-1 shrink-0', runDotClass(run.status)]"></span>
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-txt-secondary">{{ formatDate(run.started_at) }}</span>
                        <span :class="['px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase border shrink-0', runStatusClass(run.status)]">
                          {{ run.status }}
                        </span>
                      </div>
                      <div v-if="run.completed_at" class="text-txt-muted mt-0.5">
                        Completed: {{ formatDate(run.completed_at) }}
                      </div>
                      <div v-if="run.error_text" class="text-red-400 mt-1 break-words bg-red-500/5 rounded px-2 py-1 border border-red-500/10">
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
        <details open class="group/section">
          <summary class="cursor-pointer select-none flex items-center gap-3 text-sm font-semibold text-txt-primary mb-4 py-2">
            <svg class="w-4 h-4 text-accent transition-transform group-open/section:rotate-90" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>
            <span class="tracking-wide uppercase text-xs text-txt-secondary">Squad Schedules</span>
            <span class="text-[10px] font-mono text-txt-muted bg-surface-2 px-2 py-0.5 rounded-full border border-edge">{{ squadSchedules.length }}</span>
            <div class="flex-1 h-px bg-gradient-to-r from-edge to-transparent"></div>
          </summary>

          <div v-if="squadSchedules.length === 0" class="flex flex-col items-center py-8">
            <div class="w-10 h-10 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
              </svg>
            </div>
            <p class="text-txt-muted text-sm">No squad schedules configured</p>
          </div>

          <div v-else class="grid gap-3">
            <div
              v-for="s in squadSchedules"
              :key="s.id"
              class="bg-surface-2/50 border border-edge rounded-xl p-4 hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden"
            >
              <!-- Top row -->
              <div class="flex flex-wrap items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2 mb-1.5">
                    <span class="font-semibold text-txt-primary break-words min-w-0">{{ s.name }}</span>
                    <span class="text-[10px] font-mono text-accent/60 bg-accent/5 px-2 py-0.5 rounded-full border border-accent/10 shrink-0">{{ s.squad_slug }}</span>
                    <span :class="[
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase border shrink-0',
                      s.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-surface-3/60 text-txt-muted border-edge'
                    ]">
                      <span v-if="s.enabled" class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {{ s.enabled ? 'Active' : 'Paused' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-txt-muted mt-1">
                    <code class="font-mono text-accent/80 bg-surface-0/60 px-2 py-0.5 rounded-lg border border-edge/50 break-all">{{ s.cron_expr }}</code>
                    <span v-if="s.next_run_at" class="flex items-center gap-1 shrink-0">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.69z"/></svg>
                      {{ formatDate(s.next_run_at) }}
                    </span>
                    <span v-if="s.last_run_at" class="flex items-center gap-1 shrink-0">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {{ formatDate(s.last_run_at) }}
                    </span>
                  </div>
                  <p v-if="s.notes" class="text-xs text-txt-muted mt-1.5 break-words">{{ s.notes }}</p>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    v-if="s.enabled"
                    @click="pauseSchedule('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="text-txt-secondary hover:text-txt-primary disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-surface-3/40 hover:bg-surface-3 border border-edge/50 hover:border-edge transition-all duration-200"
                    title="Pause"
                  >⏸ Pause</button>
                  <button
                    v-else
                    @click="resumeSchedule('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="text-txt-secondary hover:text-txt-primary disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-surface-3/40 hover:bg-surface-3 border border-edge/50 hover:border-edge transition-all duration-200"
                    title="Resume"
                  >▶ Resume</button>
                  <button
                    @click="runNow('squads', s.id)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="text-accent hover:text-white disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 hover:border-accent/40 transition-all duration-200"
                    title="Run now"
                  >▶ Run now</button>
                  <button
                    @click="toggleHistory('squads', s.id)"
                    :class="[
                      'text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200',
                      historyOpen.get(`squads-${s.id}`)
                        ? 'bg-accent/10 text-accent border-accent/20'
                        : 'bg-surface-3/40 hover:bg-surface-3 text-txt-secondary hover:text-txt-primary border-edge/50 hover:border-edge'
                    ]"
                    title="Toggle run history"
                  >📋 History</button>
                  <button
                    @click="deleteSchedule('squads', s.id, s.name)"
                    :disabled="mutating.has(`squads-${s.id}`)"
                    class="text-red-400/70 hover:text-red-400 disabled:opacity-50 text-xs px-2 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                    title="Delete"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                  </button>
                </div>
              </div>

              <!-- Prompt -->
              <div v-if="s.prompt" class="mt-3">
                <p class="text-xs text-txt-muted break-words" :class="promptExpanded.has(`squads-${s.id}`) ? '' : 'line-clamp-2'">
                  {{ s.prompt }}
                </p>
                <button
                  v-if="s.prompt.length > 120"
                  @click="togglePrompt('squads', s.id)"
                  class="text-[10px] text-accent/70 hover:text-accent mt-1 transition-colors"
                >
                  {{ promptExpanded.has(`squads-${s.id}`) ? 'Show less ▲' : 'Show more ▼' }}
                </button>
              </div>

              <!-- History panel -->
              <div v-if="historyOpen.get(`squads-${s.id}`)" class="mt-4 pt-4 border-t border-edge/50">
                <h4 class="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-3">
                  Run history — {{ s.name }}
                </h4>
                <div v-if="historyLoading.has(`squads-${s.id}`)" class="flex items-center gap-2 text-txt-muted text-xs py-2 justify-center">
                  <div class="w-1 h-1 rounded-full bg-accent animate-pulse"></div>
                  Loading…
                </div>
                <div v-else-if="!historyData.get(`squads-${s.id}`) || historyData.get(`squads-${s.id}`)!.length === 0"
                     class="text-txt-muted text-xs py-2 text-center">
                  No history yet
                </div>
                <ul v-else class="space-y-1.5">
                  <li
                    v-for="run in historyData.get(`squads-${s.id}`)"
                    :key="run.id"
                    class="flex items-start gap-2.5 text-xs bg-surface-0/50 rounded-lg p-2.5 border border-edge/30"
                  >
                    <span :class="['w-2 h-2 rounded-full mt-1 shrink-0', runDotClass(run.status)]"></span>
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-txt-secondary">{{ formatDate(run.started_at) }}</span>
                        <span :class="['px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase border shrink-0', runStatusClass(run.status)]">
                          {{ run.status }}
                        </span>
                      </div>
                      <div v-if="run.completed_at" class="text-txt-muted mt-0.5">
                        Completed: {{ formatDate(run.completed_at) }}
                      </div>
                      <div v-if="run.error_text" class="text-red-400 mt-1 break-words bg-red-500/5 rounded px-2 py-1 border border-red-500/10">
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
