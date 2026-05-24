<template>
  <div class="space-y-3">
    <!-- Header row: title + new instance button -->
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Instances</h4>
      <button
        @click="showNewForm = !showNewForm"
        class="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all duration-150"
        :class="showNewForm
          ? 'bg-surface-3/50 text-txt-secondary border border-edge hover:bg-surface-3/70'
          : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'"
      >
        <FluentIcon
          v-if="!showNewForm"
          :paths='`<path d="M10 3a.5.5 0 0 1 .5.5v6h6a.5.5 0 0 1 0 1h-6v6a.5.5 0 0 1-1 0v-6h-6a.5.5 0 0 1 0-1h6v-6A.5.5 0 0 1 10 3Z"/>`'
          :size="10"
        />
        {{ showNewForm ? 'Cancel' : 'New Instance' }}
      </button>
    </div>

    <!-- New instance form -->
    <form
      v-if="showNewForm"
      @submit.prevent="createInstance"
      class="bg-surface-3/30 border border-edge rounded-lg p-3 space-y-2 animate-fade-in"
    >
      <input
        v-model="newForm.issueRef"
        type="text"
        placeholder="Issue ref (e.g. #231 or feature-auth)"
        class="w-full bg-surface-0/50 border border-edge rounded-md px-3 py-1.5 text-xs text-txt-primary placeholder:text-txt-muted/60 focus:outline-none focus:border-accent/40 transition-all duration-150"
      />
      <input
        v-model="newForm.baseBranch"
        type="text"
        placeholder="Base branch (default: main)"
        class="w-full bg-surface-0/50 border border-edge rounded-md px-3 py-1.5 text-xs text-txt-primary placeholder:text-txt-muted/60 focus:outline-none focus:border-accent/40 transition-all duration-150"
      />
      <div class="flex items-center gap-2 pt-1">
        <button
          type="submit"
          :disabled="creating || !newForm.issueRef.trim()"
          class="flex-1 bg-accent/15 text-accent border border-accent/25 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
        >
          {{ creating ? 'Spawning…' : 'Spawn Instance' }}
        </button>
      </div>
      <p v-if="createError" class="text-[10px] text-red-400">{{ createError }}</p>
    </form>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center gap-2 text-txt-muted text-xs py-2">
      <span class="w-3 h-3 border-2 border-edge border-t-accent rounded-full animate-spin shrink-0"></span>
      Loading instances…
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-red-400 text-xs py-1">{{ error }}</div>

    <!-- Empty state -->
    <div v-else-if="instances.length === 0" class="text-txt-muted text-xs italic py-1">
      No active instances
    </div>

    <!-- Instance cards -->
    <div v-else class="space-y-2">
      <div
        v-for="inst in instances"
        :key="inst.id"
        class="bg-surface-2/50 border border-edge rounded-lg overflow-hidden animate-fade-in"
      >
        <!-- Instance card header -->
        <div class="flex items-center gap-2 px-3 py-2">
          <!-- Status badge -->
          <span
            class="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            :class="statusClass(inst.status)"
          >{{ inst.status }}</span>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium text-txt-primary truncate">{{ inst.issue_ref ?? inst.id }}</span>
            </div>
            <p class="text-[10px] text-txt-muted font-mono truncate">{{ inst.branch_name }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <!-- Toggle decisions -->
            <button
              @click="toggleDecisions(inst.id)"
              class="p-1 rounded text-txt-muted hover:text-txt-secondary hover:bg-surface-3/50 transition-all duration-150"
              :title="expandedDecisions.has(inst.id) ? 'Hide decisions' : 'Show decisions'"
            >
              <FluentIcon
                :paths='`<path d="M7.47 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1-1.06 1.06L8 5.81 3.28 10.53a.75.75 0 0 1-1.06-1.06l5.25-5.25Z"/>`'
                :size="12"
                class="transition-transform duration-150"
                :class="expandedDecisions.has(inst.id) ? 'rotate-180' : ''"
              />
            </button>

            <!-- Complete button (active/pending only) -->
            <button
              v-if="isActive(inst.status)"
              @click="completeInstance(inst.id)"
              :disabled="!!working[inst.id]"
              class="text-[10px] font-medium px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-40 transition-all duration-150"
              title="Merge decisions back and complete"
            >
              {{ working[inst.id] === 'completing' ? 'Merging…' : 'Complete' }}
            </button>

            <!-- Abort button (active/pending only) -->
            <button
              v-if="isActive(inst.status)"
              @click="abortInstance(inst.id)"
              :disabled="!!working[inst.id]"
              class="text-[10px] font-medium px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-all duration-150"
              title="Abort — worktree preserved for debugging"
            >
              {{ working[inst.id] === 'aborting' ? 'Aborting…' : 'Abort' }}
            </button>
          </div>
        </div>

        <!-- Instance meta -->
        <div class="px-3 pb-2 flex items-center gap-3 text-[10px] text-txt-muted">
          <span>Created {{ formatTime(inst.created_at) }}</span>
          <span v-if="inst.completed_at">· Completed {{ formatTime(inst.completed_at) }}</span>
        </div>

        <!-- Decisions panel -->
        <div
          v-if="expandedDecisions.has(inst.id)"
          class="border-t border-edge/50 px-3 py-2 bg-surface-0/40 animate-fade-in"
        >
          <div v-if="decisionsLoading[inst.id]" class="flex items-center gap-2 text-txt-muted text-[10px] py-1">
            <span class="w-2.5 h-2.5 border border-edge border-t-accent rounded-full animate-spin"></span>
            Loading decisions…
          </div>
          <div v-else-if="!decisions[inst.id] || decisions[inst.id].length === 0" class="text-txt-muted text-[10px] italic py-1">
            No decisions logged yet
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="(d, i) in decisions[inst.id]"
              :key="i"
              class="text-[10px] leading-snug"
            >
              <div class="flex items-start gap-1.5">
                <span
                  class="shrink-0 mt-0.5 w-3 h-3 rounded-full border flex items-center justify-center"
                  :class="d.merged_to_master ? 'border-green-500/40 bg-green-500/10' : 'border-edge bg-surface-3/40'"
                  :title="d.merged_to_master ? 'Merged to master' : 'Pending merge'"
                >
                  <span v-if="d.merged_to_master" class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-txt-secondary">{{ d.decision }}</p>
                  <p v-if="d.context" class="text-txt-muted mt-0.5 leading-relaxed">{{ d.context }}</p>
                  <p class="text-txt-muted/60 mt-0.5">{{ formatTime(d.created_at) }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Per-instance error -->
        <div v-if="instanceError[inst.id]" class="px-3 pb-2 text-[10px] text-red-400">
          {{ instanceError[inst.id] }}
        </div>
      </div>

      <!-- Show completed toggle -->
      <button
        @click="toggleShowCompleted"
        class="w-full text-center text-[10px] text-txt-muted hover:text-txt-secondary py-1 transition-colors duration-150"
      >
        {{ showCompleted ? 'Hide completed' : 'Show completed instances' }}
      </button>
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

function statusClass(status: string): string {
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
