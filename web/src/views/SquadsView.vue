<template>
  <div class="flex flex-col h-full bg-surface-0">
    <div class="flex-1 overflow-y-auto p-3 sm:p-6">
      <div class="max-w-4xl">
        <div class="flex justify-between items-end mb-6">
          <div>
            <h2 class="text-xl font-bold text-txt-primary tracking-tight">Squads</h2>
            <p class="text-xs text-txt-muted mt-0.5">Manage teams and monitor agents</p>
          </div>
          <button
            @click="showCreateForm = !showCreateForm"
            class="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            :class="showCreateForm
              ? 'bg-surface-3/50 text-txt-secondary border border-edge hover:bg-surface-3/70'
              : 'bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 hover:border-accent/40'"
          >
            {{ showCreateForm ? 'Cancel' : 'New Squad' }}
          </button>
        </div>

        <!-- Create Squad Form -->
        <form
          v-if="showCreateForm"
          @submit.prevent="createSquad"
          class="bg-surface-2/40 border border-edge rounded-xl p-5 mb-6 animate-fade-in"
        >
          <h3 class="font-semibold text-txt-primary text-sm mb-4">Create New Squad</h3>
          <div class="space-y-3">
            <input
              v-model="form.slug"
              type="text"
              placeholder="Squad slug (e.g., frontend-team)"
              class="w-full bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                     placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm transition-all duration-200"
            />
            <input
              v-model="form.name"
              type="text"
              placeholder="Squad name (e.g., Frontend Team)"
              class="w-full bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                     placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm transition-all duration-200"
            />
            <input
              v-model="form.projectPath"
              type="text"
              placeholder="Project path (e.g., /path/to/project)"
              class="w-full bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                     placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm transition-all duration-200"
            />
            <button
              type="submit"
              :disabled="creating || !form.slug || !form.name || !form.projectPath"
              class="w-full bg-accent/15 text-accent border border-accent/25 px-4 py-2 rounded-lg text-sm font-medium
                     hover:bg-accent/25 hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              {{ creating ? 'Creating…' : 'Create Squad' }}
            </button>
          </div>
          <div v-if="createError" class="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <span>⚠</span> {{ createError }}
          </div>
        </form>

        <!-- List states -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div class="flex items-center gap-2 text-txt-muted text-sm">
            <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
            Loading squads…
          </div>
        </div>

        <div v-else-if="error" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-4 text-sm">
          <span>⚠</span> {{ error }}
        </div>

        <div v-else-if="squads.length === 0" class="text-txt-muted text-sm text-center py-16">
          No squads created yet
        </div>

        <!-- Squad cards -->
        <div v-else class="grid gap-3">
          <div
            v-for="squad in squads"
            :key="squad.id"
            class="bg-surface-2/40 border border-edge rounded-xl overflow-hidden
                   hover:border-edge-bright transition-all duration-200"
          >
            <button
              type="button"
              @click="toggleSquad(squad.slug)"
              class="w-full text-left p-4 focus:outline-none"
              :aria-expanded="isExpanded(squad.slug)"
            >
              <div class="flex justify-between items-start mb-2">
                <div class="flex-1 flex items-center gap-2.5">
                  <FluentIcon :paths='`<path d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"/>`' :size="14" class="text-txt-muted transition-transform duration-200 shrink-0" :class="isExpanded(squad.slug) ? 'rotate-90' : ''"/>
                  <div class="min-w-0">
                    <h3 class="font-semibold text-txt-primary text-sm">{{ squad.name }}</h3>
                    <p class="text-[11px] text-txt-muted font-mono">{{ squad.slug }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span v-if="squad.universe" class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    🎬 {{ universeLabel(squad.universe) }}
                  </span>
                  <span
                    class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                    :class="squad.status === 'working'
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : squad.status === 'error'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-surface-3/60 text-txt-muted border border-edge'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="squad.status === 'working' ? 'bg-accent animate-pulse' : squad.status === 'error' ? 'bg-red-400' : 'bg-txt-muted/50'"></span>
                    {{ squad.status }}
                  </span>
                </div>
              </div>
              <p class="text-xs text-txt-muted font-mono ml-6">📁 {{ squad.project_path }}</p>
            </button>

            <!-- Expanded: agent roster -->
            <div v-if="isExpanded(squad.slug)" class="border-t border-edge px-4 pb-4 pt-3 animate-fade-in">
              <div class="flex justify-between items-center text-[10px] text-txt-muted mb-3">
                <span v-if="squad.model" class="font-mono">Model: {{ squad.model }}</span>
                <span>{{ formatDate(squad.created_at) }}</span>
              </div>

              <h4 class="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-2">Team Roster</h4>

              <div v-if="agentsLoading[squad.slug]" class="flex items-center gap-2 text-txt-muted text-xs py-3">
                <span class="w-3 h-3 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
                Loading agents…
              </div>
              <div v-else-if="agentsError[squad.slug]" class="text-red-400 text-xs py-2">
                {{ agentsError[squad.slug] }}
              </div>
              <div v-else-if="!agentsBySquad[squad.slug] || agentsBySquad[squad.slug].length === 0"
                   class="text-txt-muted text-xs italic py-2">
                No agents assigned yet
              </div>
              <ul v-else class="space-y-1.5">
                <li
                  v-for="agent in sortedAgents(agentsBySquad[squad.slug] ?? [])"
                  :key="agent.id ?? agent.character_name"
                  class="flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150"
                  :class="agent.status === 'working'
                    ? 'bg-accent/[0.06] border border-accent/15'
                    : 'bg-surface-1/50 border border-edge'"
                >
                  <!-- Avatar circle -->
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                    :class="agent.status === 'working'
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : agent.status === 'error'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : 'bg-surface-3/60 text-txt-muted border border-edge'"
                  >
                    {{ (agent.character_name ?? '?').charAt(0).toUpperCase() }}
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-medium text-txt-primary truncate">{{ agent.character_name }}</span>
                      <span v-if="agent.is_lead" title="Team Lead" class="text-xs">👑</span>
                      <span v-if="agent.is_qa" title="QA / Veto Power" class="text-xs">🛡️</span>
                    </div>
                    <span class="text-[10px] text-txt-muted">{{ agent.role_title }}</span>
                  </div>

                  <!-- Status -->
                  <span
                    class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                    :class="agent.status === 'working'
                      ? 'bg-accent/10 text-accent'
                      : agent.status === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-surface-3/40 text-txt-muted'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full"
                      :class="agent.status === 'working' ? 'bg-accent animate-pulse' : agent.status === 'error' ? 'bg-red-400' : 'bg-emerald-400'"
                    ></span>
                    {{ agent.status }}
                  </span>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      v-if="agent.status === 'working' && agent.currentTaskId"
                      type="button"
                      @click="openPreview(agent)"
                      class="text-[10px] font-medium px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/20
                             hover:bg-accent/20 transition-all duration-150 flex items-center gap-1"
                      title="Preview live work"
                    >
                      <span aria-hidden="true">👁</span> Preview
                    </button>
                    <button
                      v-if="agent.status === 'working' && agent.currentTaskId"
                      type="button"
                      @click="stopAgentTask(squad.slug, agent.currentTaskId)"
                      :disabled="stoppingTaskIds.has(agent.currentTaskId)"
                      class="text-[10px] font-medium px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20
                             hover:bg-red-500/20 disabled:opacity-40 transition-all duration-150 flex items-center gap-1"
                      title="Stop task"
                    >
                      <span class="w-2 h-2 rounded-[2px] bg-red-400"></span>
                      {{ stoppingTaskIds.has(agent.currentTaskId) ? 'Stopping…' : 'Stop' }}
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live agent preview modal -->
    <div
      v-if="previewAgent"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="closePreview"
    >
      <div class="bg-surface-1 border border-edge rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
        <div class="flex justify-between items-center px-5 py-3.5 border-b border-edge">
          <div>
            <h3 class="text-sm font-semibold text-txt-primary flex items-center gap-2">
              {{ previewAgent.character_name }}
              <span class="text-xs font-normal text-txt-muted">— {{ previewAgent.role_title }}</span>
            </h3>
            <p class="text-[10px] text-txt-muted mt-0.5 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full" :class="previewConnected ? 'bg-emerald-400 animate-pulse' : 'bg-txt-muted/50'"></span>
              {{ previewStatusLabel }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5 text-[10px] text-txt-muted cursor-pointer select-none">
              <input type="checkbox" v-model="previewSummaryMode" class="rounded bg-surface-3 border-edge accent-accent" />
              Summary
            </label>
            <button
              type="button"
              @click="closePreview"
              class="text-txt-muted hover:text-txt-primary text-lg leading-none transition-colors p-1"
              aria-label="Close"
            >×</button>
          </div>
        </div>

        <div ref="previewScrollEl" class="overflow-y-auto p-4 space-y-2 flex-1 font-mono text-xs">
          <div v-if="previewError" class="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg text-sm">{{ previewError }}</div>
          <div v-else-if="previewEvents.length === 0" class="text-txt-muted italic text-center py-8">
            Waiting for activity…
          </div>

          <!-- Summary mode -->
          <template v-else-if="previewSummaryMode">
            <div
              v-for="(ev, idx) in summarizedPreviewEvents"
              :key="idx"
              class="flex items-start gap-2 py-1.5 px-1"
            >
              <span class="shrink-0">{{ ev.summary.icon }}</span>
              <div class="flex-1 min-w-0">
                <span class="text-txt-secondary break-words">{{ ev.summary.summary }}</span>
                <span class="text-txt-muted text-[10px] ml-2">{{ formatEventTime(ev.ts) }}</span>
              </div>
            </div>
            <div v-if="summarizedPreviewEvents.length === 0" class="text-txt-muted italic text-center py-4">
              Processing…
            </div>
          </template>

          <!-- Raw mode -->
          <template v-else>
            <div
              v-for="(ev, idx) in previewEvents"
              :key="idx"
              class="border border-edge rounded-lg p-2.5 bg-surface-0"
            >
              <div class="flex justify-between items-center mb-1">
                <span class="text-accent">{{ ev.type }}</span>
                <span class="text-txt-muted text-[10px]">{{ formatEventTime(ev.ts) }}</span>
              </div>
              <pre class="text-txt-secondary whitespace-pre-wrap break-words">{{ formatEventBody(ev) }}</pre>
            </div>
          </template>
        </div>

        <div class="px-4 py-3 border-t border-edge flex justify-end">
          <button
            type="button"
            @click="closePreview"
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
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import { apiFetch, authenticatedUrl } from '../lib/api'

interface Squad {
  id: number
  slug: string
  name: string
  project_path: string
  copilot_session_id: string | null
  model: string | null
  universe: string | null
  status: string
  created_at: string
  updated_at: string
}

interface SquadAgent {
  id?: number
  squad_slug?: string
  character_name: string
  role_title: string
  charter?: string | null
  model_tier?: string
  personality?: string | null
  status: string
  currentTaskId?: string | null
  currentTask?: string | null
  is_lead?: number
  is_qa?: number
}

/** Mirrors the ActivityEntry shape emitted by src/copilot/event-summary.ts */
interface ActivityEntry {
  ts: number
  kind: string
  icon: string
  summary: string
  detail?: string
  rawType: string
  raw: unknown
  toolCallId?: string
  status?: 'pending' | 'success' | 'error'
}

/** SSE payload: raw event fields + server-computed summary */
interface PreviewEvent {
  ts: number
  type: string
  data: unknown
  summary: ActivityEntry
}

/** Event kinds to hide in summary mode (noise / session lifecycle) */
const SUMMARY_SKIP_KINDS = new Set(['system'])

const UNIVERSE_NAMES: Record<string, string> = {
  'a-team': 'The A-Team',
  'transformers': 'Transformers',
  'thundercats': 'ThunderCats',
  'gi-joe': 'G.I. Joe',
  'aliens': 'Aliens',
  'ghostbusters': 'Ghostbusters',
}

const squads = ref<Squad[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)

const expanded = reactive<Record<string, boolean>>({})
const agentsBySquad = reactive<Record<string, SquadAgent[]>>({})

function sortedAgents(agents: SquadAgent[]): SquadAgent[] {
  return [...agents].sort((a, b) => {
    const rank = (ag: SquadAgent) => ag.is_lead ? 0 : ag.is_qa ? 1 : 2
    return rank(a) - rank(b)
  })
}
const agentsLoading = reactive<Record<string, boolean>>({})
const agentsError = reactive<Record<string, string | null>>({})
const stoppingTaskIds = ref<Set<string>>(new Set())

const previewAgent = ref<SquadAgent | null>(null)
const previewEvents = ref<PreviewEvent[]>([])
const previewError = ref<string | null>(null)
const previewConnected = ref(false)
const previewSummaryMode = ref(true)
const previewScrollEl = ref<HTMLElement | null>(null)
let previewSource: EventSource | null = null

const previewStatusLabel = computed(() => {
  if (previewError.value) return 'Disconnected'
  if (previewConnected.value) return 'Live'
  return 'Connecting…'
})

const summarizedPreviewEvents = computed<PreviewEvent[]>(() => {
  return previewEvents.value.filter((ev) => {
    if (!ev.summary) return false
    if (SUMMARY_SKIP_KINDS.has(ev.summary.kind)) return false
    if (ev.type === 'assistant.message_delta') return false
    return true
  })
})

const formatEventTime = (ts: number) => {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ''
  }
}

const formatEventBody = (ev: { type: string; data: unknown }) => {
  const d = ev.data as Record<string, unknown> | null | undefined
  if (!d || typeof d !== 'object') return ''
  if (typeof (d as { deltaContent?: string }).deltaContent === 'string') {
    return (d as { deltaContent: string }).deltaContent
  }
  if (typeof (d as { content?: string }).content === 'string') {
    return (d as { content: string }).content
  }
  if (typeof (d as { text?: string }).text === 'string') {
    return (d as { text: string }).text
  }
  try {
    return JSON.stringify(d, null, 2)
  } catch {
    return String(d)
  }
}

const scrollPreviewToBottom = () => {
  nextTick(() => {
    const el = previewScrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const openPreview = async (agent: SquadAgent) => {
  if (!agent.currentTaskId) return
  closePreview()
  previewAgent.value = agent
  previewEvents.value = []
  previewError.value = null
  previewConnected.value = false
  previewSummaryMode.value = true

  const url = await authenticatedUrl(`/api/tasks/${encodeURIComponent(agent.currentTaskId)}/events`)
  const es = new EventSource(url)
  previewSource = es

  es.onopen = () => { previewConnected.value = true }
  es.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data) as PreviewEvent
      previewEvents.value.push(ev)
      scrollPreviewToBottom()
    } catch {
      // ignore
    }
  }
  es.onerror = () => {
    previewConnected.value = false
    if (previewEvents.value.length === 0) {
      previewError.value = 'Connection error. Retrying…'
    }
  }
}

const closePreview = () => {
  if (previewSource) {
    try { previewSource.close() } catch { /* ignore */ }
    previewSource = null
  }
  previewAgent.value = null
  previewEvents.value = []
  previewError.value = null
  previewConnected.value = false
}

onBeforeUnmount(() => {
  closePreview()
})

const stopAgentTask = async (squadSlug: string, taskId: string) => {
  if (stoppingTaskIds.value.has(taskId)) return
  stoppingTaskIds.value = new Set(stoppingTaskIds.value).add(taskId)
  try {
    await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' })
    await loadAgents(squadSlug, true)
  } catch (e) {
    agentsError[squadSlug] = e instanceof Error ? e.message : 'Failed to stop task'
  } finally {
    const next = new Set(stoppingTaskIds.value)
    next.delete(taskId)
    stoppingTaskIds.value = next
  }
}

const form = ref({
  slug: '',
  name: '',
  projectPath: '',
})

const universeLabel = (id: string | null) => {
  if (!id) return ''
  return UNIVERSE_NAMES[id] ?? id
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const isExpanded = (slug: string) => !!expanded[slug]

const toggleSquad = async (slug: string) => {
  expanded[slug] = !expanded[slug]
  if (expanded[slug] && !agentsBySquad[slug] && !agentsLoading[slug]) {
    await loadAgents(slug)
  }
}

const loadAgents = async (slug: string, force = false) => {
  if (!force && agentsLoading[slug]) return
  agentsLoading[slug] = true
  agentsError[slug] = null
  try {
    const response = await apiFetch(`/api/squads/${encodeURIComponent(slug)}/agents`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as { agents: SquadAgent[] }
    agentsBySquad[slug] = data.agents
  } catch (e) {
    agentsError[slug] = e instanceof Error ? e.message : 'Failed to load agents'
  } finally {
    agentsLoading[slug] = false
  }
}

const loadSquads = async () => {
  try {
    const response = await apiFetch('/api/squads')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as { squads: Squad[] }
    squads.value = data.squads
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load squads'
  } finally {
    loading.value = false
  }
}

const createSquad = async () => {
  if (!form.value.slug || !form.value.name || !form.value.projectPath) {
    createError.value = 'All fields are required'
    return
  }

  creating.value = true
  createError.value = null

  try {
    const response = await apiFetch('/api/squads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: form.value.slug,
        name: form.value.name,
        projectPath: form.value.projectPath,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    form.value = { slug: '', name: '', projectPath: '' }
    showCreateForm.value = false
    await loadSquads()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create squad'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadSquads()
})
</script>

<style scoped>
</style>
