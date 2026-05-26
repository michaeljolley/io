<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type Squad = {
  id: string
  slug: string
  name: string
  project_path: string
  universe?: string
  created_at: string
  agents_count: number
  instances_active: number
  instances_total: number
}

type Agent = {
  character_name: string
  role_title: string
  status: string
  currentTask?: string | null
  currentTaskId?: string | null
}

type Instance = {
  id: string
  issue_ref?: string | null
  status: string
  branch_name?: string | null
  worktree_path?: string | null
  created_at: string
  completed_at?: string | null
}

type Decision = {
  decision: string
  context?: string | null
  created_at: string
  merged_to_master?: boolean
}

const squads = ref<Squad[]>([])
const selectedSlug = ref('')
const agentsBySlug = ref<Record<string, Agent[]>>({})
const instancesBySlug = ref<Record<string, Instance[]>>({})
const decisionsByInstance = ref<Record<string, Decision[]>>({})
const createForm = ref({ slug: '', name: '', projectPath: '' })
const instanceForm = ref({ issueRef: '', baseBranch: '' })
const selectedInstanceId = ref('')

const selectedSquad = computed(() => squads.value.find((squad) => squad.slug === selectedSlug.value) ?? null)
const selectedAgents = computed(() => agentsBySlug.value[selectedSlug.value] ?? [])
const selectedInstances = computed(() => instancesBySlug.value[selectedSlug.value] ?? [])
const selectedDecisions = computed(() => decisionsByInstance.value[selectedInstanceId.value] ?? [])

async function loadSquads() {
  const response = await apiFetch('/api/squads')
  if (response.ok) {
    squads.value = (await response.json() as { squads: Squad[] }).squads
    if (!selectedSlug.value && squads.value[0]) {
      await selectSquad(squads.value[0].slug)
    }
  }
}

async function loadDetails(slug: string) {
  const [agentsResponse, instancesResponse] = await Promise.all([
    apiFetch(`/api/squads/${encodeURIComponent(slug)}/agents`),
    apiFetch(`/api/squads/${encodeURIComponent(slug)}/instances`),
  ])

  if (agentsResponse.ok) {
    agentsBySlug.value = {
      ...agentsBySlug.value,
      [slug]: (await agentsResponse.json() as { agents: Agent[] }).agents,
    }
  }
  if (instancesResponse.ok) {
    const instances = (await instancesResponse.json() as { instances: Instance[] }).instances
    instancesBySlug.value = {
      ...instancesBySlug.value,
      [slug]: instances,
    }
    if (!selectedInstanceId.value && instances[0]) {
      await selectInstance(instances[0].id)
    }
  }
}

async function selectSquad(slug: string) {
  selectedSlug.value = slug
  selectedInstanceId.value = ''
  await loadDetails(slug)
}

async function selectInstance(id: string) {
  if (!selectedSlug.value) return
  selectedInstanceId.value = id
  const response = await apiFetch(`/api/squads/${encodeURIComponent(selectedSlug.value)}/instances/${encodeURIComponent(id)}`)
  if (response.ok) {
    decisionsByInstance.value = {
      ...decisionsByInstance.value,
      [id]: (await response.json() as { decisions: Decision[] }).decisions,
    }
  }
}

async function createSquad() {
  if (!createForm.value.slug || !createForm.value.name || !createForm.value.projectPath) return
  await apiFetch('/api/squads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createForm.value),
  })
  createForm.value = { slug: '', name: '', projectPath: '' }
  await loadSquads()
}

async function createInstance() {
  if (!selectedSlug.value || !instanceForm.value.issueRef.trim()) return
  const payload: Record<string, string> = { issueRef: instanceForm.value.issueRef.trim() }
  if (instanceForm.value.baseBranch.trim()) {
    payload.baseBranch = instanceForm.value.baseBranch.trim()
  }
  await apiFetch(`/api/squads/${encodeURIComponent(selectedSlug.value)}/instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  instanceForm.value = { issueRef: '', baseBranch: '' }
  await loadDetails(selectedSlug.value)
}

async function completeInstance(id: string) {
  if (!selectedSlug.value) return
  await apiFetch(`/api/squads/${encodeURIComponent(selectedSlug.value)}/instances/${encodeURIComponent(id)}/complete`, { method: 'POST' })
  await loadDetails(selectedSlug.value)
}

async function abortInstance(id: string) {
  if (!selectedSlug.value) return
  await apiFetch(`/api/squads/${encodeURIComponent(selectedSlug.value)}/instances/${encodeURIComponent(id)}/abort`, { method: 'POST' })
  await loadDetails(selectedSlug.value)
}

onMounted(loadSquads)
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
    <section class="min-h-0 overflow-y-auto rounded-[28px] border border-line bg-[#09090d]/96 p-4">
      <div class="rounded-[28px] border border-cyan/35 bg-gradient-to-r from-cyan/10 via-panel to-panel p-5 shadow-glow">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">squad foundry</div>
        <div class="mt-4 grid gap-3 lg:grid-cols-3">
          <input v-model="createForm.slug" class="focus-ring rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm text-white" placeholder="slug" />
          <input v-model="createForm.name" class="focus-ring rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm text-white" placeholder="name" />
          <input v-model="createForm.projectPath" class="focus-ring rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm text-white" placeholder="project path" />
        </div>
        <button class="mt-3 rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan" @click="createSquad">create squad</button>
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="squad in squads"
          :key="squad.slug"
          class="rounded-[28px] border p-5 text-left transition"
          :class="selectedSlug === squad.slug ? 'border-cyan bg-cyan/10 shadow-glow' : 'border-line bg-surface hover:border-bright hover:bg-elevated'"
          @click="selectSquad(squad.slug)"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xl font-semibold text-white">{{ squad.name }}</div>
              <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">{{ squad.slug }}</div>
            </div>
            <div class="rounded-full border border-violet/40 bg-violet/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-violet">{{ squad.instances_active }}/{{ squad.instances_total }}</div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 font-mono text-xs uppercase tracking-[0.18em] text-mist">
            <div class="rounded-2xl border border-line bg-panel px-3 py-3">
              <div>agents</div>
              <div class="mt-2 text-lg text-white">{{ squad.agents_count }}</div>
            </div>
            <div class="rounded-2xl border border-line bg-panel px-3 py-3">
              <div>universe</div>
              <div class="mt-2 text-sm text-white">{{ squad.universe ?? 'default' }}</div>
            </div>
          </div>
          <div class="mt-4 font-mono text-[11px] text-mist">{{ squad.project_path }}</div>
        </button>
      </div>
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-violet/35 bg-surface/95 shadow-violet">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">live roster</div>
        <div class="mt-2 text-2xl font-semibold text-white">{{ selectedSquad?.name ?? 'Select a squad' }}</div>
      </div>

      <div v-if="selectedSquad" class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="rounded-[24px] border border-line bg-panel px-4 py-4">
          <div class="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">launch instance</div>
          <input v-model="instanceForm.issueRef" class="focus-ring w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm text-white" placeholder="issue ref" />
          <input v-model="instanceForm.baseBranch" class="focus-ring mt-3 w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm text-white" placeholder="base branch (optional)" />
          <button class="mt-3 rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan" @click="createInstance">create instance</button>
        </div>

        <div class="mt-4 rounded-[24px] border border-line bg-panel p-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">agents</div>
          <div class="mt-3 space-y-2">
            <div v-for="agent in selectedAgents" :key="agent.character_name" class="rounded-2xl border border-line bg-black/20 px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-white">{{ agent.character_name }}</div>
                  <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{{ agent.role_title }}</div>
                </div>
                <div class="font-mono text-[11px] uppercase tracking-[0.18em]" :class="agent.status === 'active' ? 'text-success' : 'text-mist'">{{ agent.status }}</div>
              </div>
              <div class="mt-2 text-sm text-slate-300">{{ agent.currentTask ?? 'idle' }}</div>
            </div>
            <div v-if="!selectedAgents.length" class="rounded-2xl border border-dashed border-line px-3 py-8 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no agents reported</div>
          </div>
        </div>

        <div class="mt-4 rounded-[24px] border border-line bg-panel p-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-violet">instances</div>
          <div class="mt-3 space-y-3">
            <article v-for="instance in selectedInstances" :key="instance.id" class="rounded-2xl border px-4 py-4" :class="selectedInstanceId === instance.id ? 'border-violet bg-violet/10' : 'border-line bg-black/20'">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <button class="text-left" @click="selectInstance(instance.id)">
                  <div class="font-mono text-xs text-violet">{{ instance.branch_name ?? instance.id }}</div>
                  <div class="mt-1 text-sm text-white">{{ instance.issue_ref ?? 'manual instance' }}</div>
                </button>
                <div class="font-mono text-[11px] uppercase tracking-[0.18em]" :class="instance.status === 'completed' ? 'text-success' : instance.status === 'aborted' ? 'text-danger' : 'text-cyan'">{{ instance.status }}</div>
              </div>
              <div class="mt-2 font-mono text-[11px] text-mist">{{ instance.worktree_path ?? '—' }}</div>
              <div class="mt-3 flex gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
                <button class="rounded-full border border-success/40 px-3 py-1.5 text-success" @click="completeInstance(instance.id)">complete</button>
                <button class="rounded-full border border-danger/40 px-3 py-1.5 text-danger" @click="abortInstance(instance.id)">abort</button>
              </div>
            </article>
            <div v-if="!selectedInstances.length" class="rounded-2xl border border-dashed border-line px-3 py-8 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no instances yet</div>
          </div>
        </div>

        <div class="mt-4 rounded-[24px] border border-line bg-panel p-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">decisions</div>
          <div class="mt-3 space-y-3">
            <article v-for="decision in selectedDecisions" :key="`${decision.created_at}-${decision.decision}`" class="rounded-2xl border border-line bg-black/20 px-4 py-4">
              <div class="text-sm font-medium text-white">{{ decision.decision }}</div>
              <div class="mt-2 text-sm leading-6 text-slate-300">{{ decision.context }}</div>
              <div class="mt-3 font-mono text-[11px] uppercase tracking-[0.18em]" :class="decision.merged_to_master ? 'text-success' : 'text-mist'">{{ decision.merged_to_master ? 'merged to master' : 'pending merge' }}</div>
            </article>
            <div v-if="selectedInstanceId && !selectedDecisions.length" class="rounded-2xl border border-dashed border-line px-3 py-8 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no decisions for selected instance</div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-1 items-center justify-center font-mono text-xs uppercase tracking-[0.24em] text-mist">select a squad to inspect agents and instances</div>
    </section>
  </div>
</template>
