<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import StatusIndicator from '@/components/StatusIndicator.vue'
import type { SquadAgent } from '@/lib/mission-control'

const props = defineProps<{
  agent: SquadAgent
  universeColor: string
}>()

const expanded = ref(false)
const charterText = computed(() => props.agent.charter || props.agent.role_title || 'No charter available.')
</script>

<template>
  <div class="cursor-pointer" @click="expanded = !expanded">
    <div class="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
      <StatusIndicator :status="agent.status" />
      <span class="shrink-0 font-mono text-xs font-medium" :style="{ color: universeColor }">{{ agent.character_name }}</span>
      <div class="flex shrink-0 gap-1">
        <span v-if="agent.is_lead" class="rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] leading-none text-primary">LEAD</span>
        <span v-if="agent.is_qa" class="rounded bg-status-success/10 px-1 py-0.5 font-mono text-[9px] leading-none text-status-success">QA</span>
      </div>
      <div class="min-w-0 flex-1">
        <span v-if="agent.current_task" class="block truncate font-mono text-[11px] text-foreground/60">↳ {{ agent.current_task }}</span>
        <span v-else class="font-mono text-[11px] text-muted-foreground/40">idle</span>
      </div>
      <AppIcon name="chevron-down" class="h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform" :class="expanded ? 'rotate-180' : ''" />
    </div>

    <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
      <div v-if="expanded" class="mx-2 mb-1.5 rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <div class="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Charter</div>
        <div class="text-xs leading-relaxed text-foreground/60">{{ charterText }}</div>
        <div v-if="agent.role_title && agent.charter" class="mt-2 font-mono text-[10px] text-muted-foreground/45">Role · {{ agent.role_title }}</div>
      </div>
    </transition>
  </div>
</template>
