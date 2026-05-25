<template>
  <div class="p-5 space-y-4">
    <div class="flex items-center justify-between"><h1 class="text-base font-semibold text-text">Squads</h1><button @click="showCreateForm = !showCreateForm" class="text-xs px-2.5 py-1 rounded-md border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 transition-colors">{{ showCreateForm ? 'Cancel' : '+ New squad' }}</button></div>
    <div v-if="showCreateForm" class="bg-bg-card border border-border rounded-lg p-4 space-y-3"><div class="grid sm:grid-cols-3 gap-3"><input v-model="form.slug" placeholder="slug" class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><input v-model="form.name" placeholder="Display name" class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><input v-model="form.projectPath" placeholder="/path/to/project" class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /></div><div class="flex items-center gap-3"><button @click="createSquad" :disabled="creating" class="text-xs px-3 py-1.5 rounded-md bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-50 transition-colors">{{ creating ? 'Creating...' : 'Create' }}</button><span v-if="createError" class="text-xs text-accent-red">{{ createError }}</span></div></div>
    <div v-if="loading" class="py-12 text-center text-text-muted text-sm">Loading...</div>
    <div v-else-if="error" class="text-accent-red text-sm">{{ error }}</div>
    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div v-for="squad in squads" :key="squad.slug" class="bg-bg-card border border-border rounded-lg overflow-hidden">
        <button @click="toggleSquad(squad.slug)" class="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated/50 transition-colors"><div class="w-8 h-8 rounded-md bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center shrink-0"><span class="text-accent-cyan font-mono font-bold text-sm">{{ squad.slug.charAt(0).toUpperCase() }}</span></div><div class="flex-1 min-w-0"><p class="text-sm text-text font-medium truncate">{{ squad.name }}</p><p class="text-[11px] text-text-muted font-mono">{{ squad.slug }}</p></div><div class="flex items-center gap-2"><span v-if="squad.universe" class="text-[10px] text-accent-purple bg-accent-purple/10 px-1.5 py-0.5 rounded border border-accent-purple/20">{{ universeLabel(squad.universe) }}</span><svg :class="isExpanded(squad.slug) ? 'rotate-90' : ''" class="w-4 h-4 text-text-muted transition-transform shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg></div></button>
        <div v-if="isExpanded(squad.slug)" class="border-t border-border">
          <div v-if="agentsLoading[squad.slug]" class="px-4 py-3 text-xs text-text-muted">Loading agents...</div>
          <div v-else-if="agentsError[squad.slug]" class="px-4 py-3 text-xs text-accent-red">{{ agentsError[squad.slug] }}</div>
          <div v-else>
            <div v-if="(agentsBySquad[squad.slug] ?? []).length" class="divide-y divide-border"><div v-for="agent in sortedAgents(agentsBySquad[squad.slug] ?? [])" :key="`${squad.slug}-${agent.character_name}-${agent.role_title}`" class="px-4 py-2 flex items-center justify-between gap-3"><div class="flex items-center gap-2.5 min-w-0"><span class="w-1.5 h-1.5 rounded-full shrink-0" :class="agent.status === 'working' ? 'bg-accent-cyan animate-pulse' : agent.status === 'error' ? 'bg-accent-red' : 'bg-text-muted/40'"></span><div class="min-w-0"><p class="text-xs text-text truncate">{{ agent.character_name }}</p><p class="text-[10px] text-text-muted truncate">{{ agent.role_title }}</p></div></div><div class="flex items-center gap-2 shrink-0"><button v-if="agent.currentTaskId" @click.stop="openPreview(agent)" class="text-[10px] text-text-muted hover:text-text transition-colors">View</button><span v-if="agent.currentTask" class="text-[10px] text-accent-cyan truncate max-w-[100px]">{{ agent.currentTask }}</span><button v-if="agent.currentTaskId" @click.stop="stopAgentTask(squad.slug, agent.currentTaskId)" :disabled="stoppingTaskIds.has(agent.currentTaskId)" class="text-[10px] text-accent-red hover:text-accent-red/80 disabled:opacity-40">Stop</button></div></div></div>
            <div v-else class="px-4 py-3 text-xs text-text-muted">No agents</div>
          </div>
          <div class="border-t border-border px-4 py-2.5 flex items-center justify-between"><button @click.stop="toggleInstances(squad.slug)" class="text-[11px] text-text-muted hover:text-text transition-colors">{{ instancesExpanded[squad.slug] ? '▾ Instances' : '▸ Instances' }}</button><span class="text-[10px] text-text-muted">Created {{ formatDate(squad.created_at) }}</span></div>
          <SquadInstances v-if="instancesExpanded[squad.slug]" :squad-slug="squad.slug" class="border-t border-border" />
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="previewAgent" class="fixed inset-0 z-50 flex items-center justify-center p-4"><div class="absolute inset-0 bg-black/50" @click="closePreview"></div><div class="relative w-full max-w-3xl h-[70vh] bg-bg-surface border border-border rounded-xl flex flex-col overflow-hidden animate-fade-in"><div class="h-11 shrink-0 border-b border-border flex items-center justify-between px-4 gap-4"><div class="min-w-0"><p class="text-sm text-text font-medium truncate">{{ previewAgent.character_name }}</p><p class="text-[11px] text-text-muted truncate">{{ previewAgent.role_title }}</p></div><div class="flex items-center gap-3 shrink-0"><button @click="previewSummaryMode = !previewSummaryMode" class="text-[11px] text-text-muted hover:text-text transition-colors">{{ previewSummaryMode ? 'Show all events' : 'Show summary' }}</button><span class="text-[11px]" :class="previewConnected ? 'text-accent-cyan' : 'text-text-muted'">{{ previewStatusLabel }}</span><button @click="closePreview" class="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors"><svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg></button></div></div><div ref="previewScrollEl" class="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs"><p v-if="previewError" class="text-accent-red">{{ previewError }}</p><div v-for="(ev, idx) in (previewSummaryMode ? summarizedPreviewEvents : previewEvents)" :key="idx" class="bg-bg-card border border-border rounded-lg px-3 py-2"><div class="flex items-center justify-between gap-3"><span class="text-text-secondary truncate">{{ ev.summary.summary }}</span><span class="text-text-muted shrink-0">{{ formatEventTime(ev.ts) }}</span></div><pre v-if="formatEventBody(ev).trim()" class="mt-2 text-[11px] text-text-muted whitespace-pre-wrap">{{ formatEventBody(ev) }}</pre></div><p v-if="!(previewSummaryMode ? summarizedPreviewEvents : previewEvents).length && !previewError" class="text-text-muted">Waiting for activity...</p></div></div></div>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import SquadInstances from '../components/SquadInstances.vue'
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
const instancesExpanded = reactive<Record<string, boolean>>({})
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

const toggleInstances = (slug: string) => {
  instancesExpanded[slug] = !instancesExpanded[slug]
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
