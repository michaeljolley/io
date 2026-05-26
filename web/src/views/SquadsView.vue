<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SquadCard from '@/components/SquadCard.vue'
import { apiFetch } from '@/lib/api'
import { formatRelativeTime, normalizeAgentStatus, normalizeInstanceStatus, summarizeSquadStatus, type SquadAgent, type SquadCardModel, type SquadDecision, type SquadInstance, type SquadSummary, type FeedEntry } from '@/lib/mission-control'

type SquadDetailAgent = {
  character_name?: string
  role_title?: string | null
  charter?: string | null
  model_tier?: string | null
  status?: string | null
  is_lead?: boolean
  is_qa?: boolean
  currentTask?: string | null
  current_task?: string | null
}

type SquadDetailInstance = {
  id: string
  issue_ref?: string | null
  branch_name?: string | null
  status?: string | null
  worktree_path?: string | null
}

const loading = ref(false)
const error = ref('')
const squads = ref<SquadCardModel[]>([])

async function loadSquads() {
  loading.value = true
  error.value = ''

  try {
    const [squadsResponse, feedResponse] = await Promise.all([
      apiFetch('/api/squads'),
      apiFetch('/api/feed?limit=200'),
    ])

    const summaries = squadsResponse.ok ? (await squadsResponse.json() as { squads: SquadSummary[] }).squads : []
    const unreadBySquad = new Map<string, number>()

    if (feedResponse.ok) {
      const feedEntries = (await feedResponse.json() as { entries: FeedEntry[] }).entries
      for (const entry of feedEntries) {
        if (!entry.read_at && entry.squad_slug) {
          unreadBySquad.set(entry.squad_slug, (unreadBySquad.get(entry.squad_slug) ?? 0) + 1)
        }
      }
    }

    squads.value = await Promise.all(summaries.map(async (summary) => {
      const slug = summary.slug ?? summary.id ?? summary.name.toLowerCase().replace(/\s+/g, '-')
      const [agentsResponse, instancesResponse] = await Promise.all([
        apiFetch(`/api/squads/${encodeURIComponent(slug)}/agents`),
        apiFetch(`/api/squads/${encodeURIComponent(slug)}/instances`),
      ])

      const rawAgents = agentsResponse.ok ? (await agentsResponse.json() as { agents: SquadDetailAgent[] }).agents : []
      const rawInstances = instancesResponse.ok ? (await instancesResponse.json() as { instances: SquadDetailInstance[] }).instances : []

      const agents: SquadAgent[] = rawAgents.map((agent) => ({
        character_name: agent.character_name ?? 'Unnamed Agent',
        role_title: agent.role_title,
        charter: agent.charter ?? agent.role_title,
        model_tier: agent.model_tier ?? (agent.is_lead ? 'high' : 'medium'),
        status: normalizeAgentStatus(agent.status),
        is_lead: Boolean(agent.is_lead),
        is_qa: Boolean(agent.is_qa),
        current_task: agent.currentTask ?? agent.current_task ?? null,
      }))

      const instances: SquadInstance[] = rawInstances.map((instance) => ({
        id: String(instance.id),
        issue_ref: instance.issue_ref,
        branch_name: instance.branch_name,
        status: normalizeInstanceStatus(instance.status),
        worktree_path: instance.worktree_path,
      }))

      const decisionResponses = await Promise.all(instances.slice(0, 3).map((instance) => apiFetch(`/api/squads/${encodeURIComponent(slug)}/instances/${encodeURIComponent(instance.id)}`)))
      const recentDecisions: SquadDecision[] = []

      for (let index = 0; index < decisionResponses.length; index += 1) {
        const response = decisionResponses[index]
        if (!response.ok) continue
        const payload = await response.json() as { decisions?: Array<{ decision?: string; created_at?: string }> }
        for (const [decisionIndex, decision] of (payload.decisions ?? []).slice(0, 3).entries()) {
          recentDecisions.push({
            id: `${instances[index]?.id ?? index}-${decisionIndex}`,
            title: decision.decision ?? 'Decision recorded',
            timestamp: formatRelativeTime(decision.created_at),
          })
        }
      }

      return {
        id: summary.id ?? slug,
        slug,
        name: summary.name,
        project_path: summary.project_path ?? '—',
        universe: summary.universe ?? 'Ghostbusters',
        status: summarizeSquadStatus(agents, summary),
        unread_count: unreadBySquad.get(slug) ?? 0,
        agents,
        instances,
        recent_decisions: recentDecisions.slice(0, 4),
      }
    }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load squads.'
    squads.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadSquads)
</script>

<template>
  <div class="h-full overflow-y-auto p-5">
    <div v-if="error" class="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ error }}</div>

    <div v-if="loading && !squads.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="index in 6" :key="index" class="h-64 animate-pulse rounded-lg border border-border bg-card/60" />
    </div>

    <div v-else-if="squads.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SquadCard v-for="squad in squads" :key="squad.id" :squad="squad" />
    </div>

    <div v-else class="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-card/30 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/55">
      No squads discovered.
    </div>
  </div>
</template>
