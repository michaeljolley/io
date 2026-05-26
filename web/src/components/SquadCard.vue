<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AgentRow from '@/components/AgentRow.vue'
import InstancePill from '@/components/InstancePill.vue'
import StatusIndicator from '@/components/StatusIndicator.vue'
import { universeColor, withAlpha, type SquadCardModel } from '@/lib/mission-control'

const props = defineProps<{
  squad: SquadCardModel
}>()

const color = computed(() => universeColor(props.squad.universe))
const runningInstances = computed(() => props.squad.instances.filter((instance) => instance.status === 'running').length)
</script>

<template>
  <article class="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
    <div class="h-px" :style="{ backgroundColor: color, opacity: 0.6 }" />
    <div class="px-4 pb-2.5 pt-3">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <StatusIndicator :status="squad.status" />
          <h3 class="truncate text-sm font-semibold">{{ squad.name }}</h3>
          <span v-if="squad.unread_count > 0" class="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">{{ squad.unread_count }}</span>
        </div>
        <span class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]" :style="{ color, backgroundColor: withAlpha(color, 0.15) }">{{ squad.universe }}</span>
      </div>
      <div class="truncate font-mono text-[10px] text-muted-foreground/50">{{ squad.project_path }}</div>
    </div>

    <div class="mx-3 border-t border-border/50" />
    <div class="px-2 py-1.5">
      <AgentRow v-for="agent in squad.agents" :key="agent.character_name" :agent="agent" :universe-color="color" />
    </div>

    <template v-if="squad.instances.length">
      <div class="mx-3 border-t border-border/50" />
      <div class="px-4 py-2.5">
        <div class="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          <AppIcon name="git-branch" class="h-3 w-3" />
          <span>Instances ({{ runningInstances }}/{{ squad.instances.length }} running)</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <InstancePill v-for="instance in squad.instances" :key="instance.id" :instance="instance" />
        </div>
      </div>
    </template>

    <template v-if="squad.recent_decisions.length">
      <div class="mx-3 border-t border-border/50" />
      <div class="px-4 py-2.5">
        <div class="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          <AppIcon name="sparkles" class="h-3 w-3" />
          <span>Decisions</span>
        </div>
        <div class="space-y-1">
          <div v-for="decision in squad.recent_decisions" :key="decision.id" class="flex items-baseline gap-2 text-[11px]">
            <span class="shrink-0 font-mono text-muted-foreground/40">·</span>
            <span class="flex-1 text-foreground/60">{{ decision.title }}</span>
            <span class="shrink-0 font-mono text-muted-foreground/40">{{ decision.timestamp }}</span>
          </div>
        </div>
      </div>
    </template>
  </article>
</template>
