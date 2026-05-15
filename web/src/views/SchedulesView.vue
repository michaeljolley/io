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
          <FluentIcon paths="<path d=\"M11.41 3.64a.5.5 0 0 0 0-.71L9.3.8a.5.5 0 0 0-.7.7l1 1a7.5 7.5 0 0 0-4.08 13.5.5.5 0 0 0 .6-.8A6.5 6.5 0 0 1 10.14 3.5L8.59 5.04a.5.5 0 0 0 .7.7l2.12-2.11ZM8.6 16.36a.5.5 0 0 0 0 .71l2.12 2.12a.5.5 0 0 0 .7-.7l-1-1a7.5 7.5 0 0 0 4.07-13.5.5.5 0 1 0-.59.8A6.5 6.5 0 0 1 9.86 16.5l1.55-1.55a.5.5 0 1 0-.7-.7l-2.12 2.11Z\"/>" class="w-3.5 h-3.5" />
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
            <FluentIcon paths="<path d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"/>" :size="16" class="text-accent transition-transform group-open/section:rotate-90" />
            <span class="tracking-wide uppercase text-xs text-txt-secondary">IO Schedules</span>
            <span class="text-[10px] font-mono text-txt-muted bg-surface-2 px-2 py-0.5 rounded-full border border-edge">{{ ioSchedules.length }}</span>
            <div class="flex-1 h-px bg-gradient-to-r from-edge to-transparent"></div>
          </summary>

          <div v-if="ioSchedules.length === 0" class="flex flex-col items-center py-8">
            <div class="w-10 h-10 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-3">
              <FluentIcon paths="<path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-.5 2a.5.5 0 0 1 .5.41V10h2.5a.5.5 0 0 1 .09 1H9.5a.5.5 0 0 1-.5-.41V5.5c0-.28.22-.5.5-.5Z"/>" :size="20" class="text-txt-muted" />
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
                      <FluentIcon paths="<path d="M17.22 8.69a1.5 1.5 0 0 1 0 2.62l-10 5.5A1.5 1.5 0 0 1 5 15.5v-11A1.5 1.5 0 0 1 7.22 3.2l10 5.5Zm-.48 1.75a.5.5 0 0 0 0-.88l-10-5.5A.5.5 0 0 0 6 4.5v11c0 .38.4.62.74.44l10-5.5Z"/>" :size="12" />
                      {{ formatDate(s.next_run_at) }}
                    </span>
                    <span v-if="s.last_run_at" class="flex items-center gap-1 shrink-0">
                      <FluentIcon paths="<path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-.5 2a.5.5 0 0 1 .5.41V10h2.5a.5.5 0 0 1 .09 1H9.5a.5.5 0 0 1-.5-.41V5.5c0-.28.22-.5.5-.5Z"/>" :size="12" />
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
                    <FluentIcon paths="<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>" :size="14" />
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
            <FluentIcon paths="<path d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"/>" :size="16" class="text-accent transition-transform group-open/section:rotate-90" />
            <span class="tracking-wide uppercase text-xs text-txt-secondary">Squad Schedules</span>
            <span class="text-[10px] font-mono text-txt-muted bg-surface-2 px-2 py-0.5 rounded-full border border-edge">{{ squadSchedules.length }}</span>
            <div class="flex-1 h-px bg-gradient-to-r from-edge to-transparent"></div>
          </summary>

          <div v-if="squadSchedules.length === 0" class="flex flex-col items-center py-8">
            <div class="w-10 h-10 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-3">
              <FluentIcon paths="<path d="M10 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM7.5 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Zm8-.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-10 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm.6 12H5a2 2 0 0 1-2-2V9.25c0-.14.11-.25.25-.25h1.76c.04-.37.17-.7.37-1H3.25C2.56 8 2 8.56 2 9.25V13a3 3 0 0 0 3.4 2.97 4.96 4.96 0 0 1-.3-.97Zm9.5.97A3 3 0 0 0 18 13V9.25C18 8.56 17.44 8 16.75 8h-2.13c.2.3.33.63.37 1h1.76c.14 0 .25.11.25.25V13a2 2 0 0 1-2.1 2c-.07.34-.17.66-.3.97ZM7.25 8C6.56 8 6 8.56 6 9.25V14a4 4 0 0 0 8 0V9.25C14 8.56 13.44 8 12.75 8h-5.5ZM7 9.25c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25V14a3 3 0 1 1-6 0V9.25Z"/>" :size="20" class="text-txt-muted" />
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
                      <FluentIcon paths="<path d="M17.22 8.69a1.5 1.5 0 0 1 0 2.62l-10 5.5A1.5 1.5 0 0 1 5 15.5v-11A1.5 1.5 0 0 1 7.22 3.2l10 5.5Zm-.48 1.75a.5.5 0 0 0 0-.88l-10-5.5A.5.5 0 0 0 6 4.5v11c0 .38.4.62.74.44l10-5.5Z"/>" :size="12" />
                      {{ formatDate(s.next_run_at) }}
                    </span>
                    <span v-if="s.last_run_at" class="flex items-center gap-1 shrink-0">
                      <FluentIcon paths="<path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-.5 2a.5.5 0 0 1 .5.41V10h2.5a.5.5 0 0 1 .09 1H9.5a.5.5 0 0 1-.5-.41V5.5c0-.28.22-.5.5-.5Z"/>" :size="12" />
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
                    <FluentIcon paths="<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>" :size="14" />
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
