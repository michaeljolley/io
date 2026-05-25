<template>
  <div class="px-4 py-3 space-y-2">
    <div class="flex items-center justify-between"><span class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Instances</span><div class="flex items-center gap-2"><button @click="toggleShowCompleted" class="text-[10px] text-text-muted hover:text-text transition-colors">{{ showCompleted ? 'Hide completed' : 'Show completed' }}</button><button @click="showNewForm = !showNewForm" class="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors">+ New</button></div></div>
    <div v-if="showNewForm" class="bg-bg-elevated border border-border rounded-md p-3 space-y-2"><input v-model="newForm.issueRef" placeholder="Issue ref (e.g. #42)" class="w-full bg-bg-app border border-border rounded px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><input v-model="newForm.baseBranch" placeholder="Base branch (optional)" class="w-full bg-bg-app border border-border rounded px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><div class="flex items-center gap-2"><button @click="createInstance" :disabled="creating" class="text-[10px] px-2.5 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-40 transition-colors">Create</button><button @click="showNewForm = false" class="text-[10px] text-text-muted hover:text-text">Cancel</button><span v-if="createError" class="text-[10px] text-accent-red">{{ createError }}</span></div></div>
    <div v-if="loading" class="text-[11px] text-text-muted py-2 text-center">Loading...</div>
    <div v-else-if="error" class="text-[11px] text-accent-red">{{ error }}</div>
    <div v-else-if="!instances.length" class="text-[11px] text-text-muted py-2 text-center">No instances</div>
    <div v-else class="space-y-1.5">
      <div v-for="inst in instances" :key="inst.id" class="bg-bg-elevated border border-border rounded-md px-3 py-2 space-y-1">
        <div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2 min-w-0"><span :class="instanceStatusClass(inst.status)" class="text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0">{{ inst.status }}</span><span class="text-xs text-text truncate">{{ inst.issue_ref ?? inst.id.slice(0, 8) }}</span></div><div class="flex items-center gap-1.5"><button v-if="isActive(inst.status)" @click="completeInstance(inst.id)" :disabled="!!working[inst.id]" class="text-[10px] text-accent-green hover:text-accent-green/80 disabled:opacity-40">Complete</button><button v-if="isActive(inst.status)" @click="abortInstance(inst.id)" :disabled="!!working[inst.id]" class="text-[10px] text-accent-red hover:text-accent-red/80 disabled:opacity-40">Abort</button><button @click="toggleDecisions(inst.id)" class="text-[10px] text-text-muted hover:text-text transition-colors">{{ expandedDecisions.has(inst.id) ? '▾' : '▸' }} Decisions</button></div></div>
        <p class="text-[10px] font-mono text-text-muted truncate">{{ inst.branch_name }}</p>
        <p class="text-[10px] text-text-muted">Created {{ formatTime(inst.created_at) }}<span v-if="inst.completed_at"> · Completed {{ formatTime(inst.completed_at) }}</span></p>
        <p v-if="instanceError[inst.id]" class="text-[10px] text-accent-red">{{ instanceError[inst.id] }}</p>
        <div v-if="expandedDecisions.has(inst.id)" class="border-t border-border pt-2 mt-1 space-y-1.5"><p v-if="decisionsLoading[inst.id]" class="text-[10px] text-text-muted">Loading...</p><template v-else-if="decisions[inst.id]?.length"><div v-for="(dec, i) in decisions[inst.id]" :key="i" class="text-[11px] bg-bg-card border border-border rounded p-2"><p class="text-text-secondary">{{ dec.decision }}</p><p v-if="dec.context" class="text-text-muted italic mt-0.5">{{ dec.context }}</p></div></template><p v-else class="text-[10px] text-text-muted">No decisions logged</p></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import FluentIcon from './FluentIcon.vue'
import { apiFetch } from '../lib/api'

const props = defineProps<{ squadSlug: string }>()

interface InstanceSummary {
  id: string
  issue_ref: string | null
  status: string
  branch_name: string
  worktree_path: string
  created_at: string
  completed_at: string | null
}

interface InstanceDecision {
  decision: string
  context: string | null
  created_at: string
  merged_to_master: number
}

const instances = ref<InstanceSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showCompleted = ref(false)

const expandedDecisions = ref(new Set<string>())
const decisions = reactive<Record<string, InstanceDecision[]>>({})
const decisionsLoading = reactive<Record<string, boolean>>({})

const working = reactive<Record<string, 'completing' | 'aborting' | null>>({})
const instanceError = reactive<Record<string, string | null>>({})

const showNewForm = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const newForm = reactive({ issueRef: '', baseBranch: '' })

function instanceStatusClass(status: string): string {
  switch (status) {
    case 'active':   return 'bg-green-500/15 text-green-400 border-green-500/25'
    case 'pending':  return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
    case 'merging':  return 'bg-accent/15 text-accent border-accent/25'
    case 'done':     return 'bg-surface-3/50 text-txt-muted border-edge'
    case 'failed':   return 'bg-red-500/15 text-red-400 border-red-500/25'
    default:         return 'bg-surface-3/50 text-txt-muted border-edge'
  }
}

function isActive(status: string): boolean {
  return status === 'active' || status === 'pending'
}

function formatTime(ts: string): string {
  try {
    const normalized = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z'
    return new Date(normalized).toLocaleString()
  } catch { return ts }
}

async function loadInstances() {
  loading.value = true
  error.value = null
  try {
    const url = `/api/squads/${props.squadSlug}/instances${showCompleted.value ? '?include_completed=true' : ''}`
    const res = await apiFetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { instances: InstanceSummary[] }
    instances.value = data.instances ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load instances'
  } finally {
    loading.value = false
  }
}

async function toggleDecisions(id: string) {
  const next = new Set(expandedDecisions.value)
  if (next.has(id)) {
    next.delete(id)
    expandedDecisions.value = next
    return
  }
  next.add(id)
  expandedDecisions.value = next

  if (!decisions[id]) {
    decisionsLoading[id] = true
    try {
      const res = await apiFetch(`/api/squads/${props.squadSlug}/instances/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { decisions: InstanceDecision[] }
      decisions[id] = data.decisions ?? []
    } catch {
      decisions[id] = []
    } finally {
      decisionsLoading[id] = false
    }
  }
}

async function completeInstance(id: string) {
  working[id] = 'completing'
  instanceError[id] = null
  try {
    const res = await apiFetch(`/api/squads/${props.squadSlug}/instances/${id}/complete`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadInstances()
    // Refresh decisions if currently open
    if (expandedDecisions.value.has(id)) {
      delete decisions[id]
      await toggleDecisions(id)
    }
  } catch (e) {
    instanceError[id] = e instanceof Error ? e.message : 'Complete failed'
  } finally {
    working[id] = null
  }
}

async function abortInstance(id: string) {
  working[id] = 'aborting'
  instanceError[id] = null
  try {
    const res = await apiFetch(`/api/squads/${props.squadSlug}/instances/${id}/abort`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadInstances()
  } catch (e) {
    instanceError[id] = e instanceof Error ? e.message : 'Abort failed'
  } finally {
    working[id] = null
  }
}

async function createInstance() {
  const issueRef = newForm.issueRef.trim()
  if (!issueRef) return
  creating.value = true
  createError.value = null
  try {
    const body: Record<string, string> = { issue_ref: issueRef }
    if (newForm.baseBranch.trim()) body.base_branch = newForm.baseBranch.trim()
    const res = await apiFetch(`/api/squads/${props.squadSlug}/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    newForm.issueRef = ''
    newForm.baseBranch = ''
    showNewForm.value = false
    await loadInstances()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create instance'
  } finally {
    creating.value = false
  }
}

async function toggleShowCompleted() {
  showCompleted.value = !showCompleted.value
  await loadInstances()
}

watch(() => props.squadSlug, () => loadInstances())
onMounted(() => loadInstances())
</script>
