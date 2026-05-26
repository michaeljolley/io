<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { WikiTreeNode } from '@/lib/mission-control'

const props = withDefaults(defineProps<{
  node: WikiTreeNode
  selectedPath: string
  depth?: number
}>(), {
  depth: 0,
})

const emit = defineEmits<{
  (event: 'select', path: string): void
}>()

const open = ref(true)
</script>

<template>
  <div>
    <button v-if="node.children.length" class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-white/[0.03]" :style="{ paddingLeft: `${depth * 12 + 8}px` }" @click="open = !open">
      <AppIcon name="chevron-right" class="h-3 w-3 shrink-0 transition-transform" :class="open ? 'rotate-90' : ''" />
      {{ node.label }}
    </button>
    <button v-else class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors" :class="selectedPath === node.path ? 'bg-primary/10 text-primary' : 'text-foreground/60 hover:bg-white/[0.03] hover:text-foreground'" :style="{ paddingLeft: `${depth * 12 + 8}px` }" @click="node.path && emit('select', node.path)">
      {{ node.label }}
    </button>

    <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
      <div v-if="node.children.length && open" class="overflow-hidden">
        <WikiTreeNode v-for="child in node.children" :key="child.id" :node="child" :selected-path="selectedPath" :depth="depth + 1" @select="emit('select', $event)" />
      </div>
    </transition>
  </div>
</template>
