<script setup lang="ts">
import { computed } from 'vue'
import { instanceStatusColor, withAlpha, type SquadInstance } from '@/lib/mission-control'

const props = defineProps<{
  instance: SquadInstance
}>()

const color = computed(() => instanceStatusColor(props.instance.status))
</script>

<template>
  <div class="flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px]" :style="{ borderColor: withAlpha(color, 0.3), backgroundColor: withAlpha(color, 0.08) }">
    <div class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: color }" />
    <span :style="{ color }">{{ instance.issue_ref || instance.id }}</span>
    <span class="text-muted-foreground/50">·</span>
    <span class="max-w-[120px] truncate text-muted-foreground">{{ instance.branch_name || 'detached' }}</span>
  </div>
</template>
