<template>
  <div
    v-if="!chatOpen"
    class="fixed bottom-12 left-1/2 -translate-x-1/2 z-40"
  >
    <button
      @click="openChat"
      class="flex items-center gap-2 w-[360px] max-w-[calc(100vw-2rem)] px-4 py-2
             rounded-full bg-bg-surface border border-border shadow-lg
             hover:border-border-bright hover:shadow-glow-sm transition-all duration-200"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-text-muted shrink-0"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.58 3.58a.75.75 0 1 1-1.06 1.06l-3.58-3.58A7 7 0 0 1 2 9Z" clip-rule="evenodd"/></svg>
      <span class="flex-1 text-left text-sm text-text-muted">Command IO...</span>
      <kbd class="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border font-mono">{{ isMac ? '⌘K' : 'Ctrl+K' }}</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ chatOpen: boolean }>()
const emit = defineEmits<{ open: [] }>()

const isMac = ref(false)

function openChat() {
  emit('open')
}

function handleKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (!props.chatOpen) openChat()
  }
}

onMounted(() => {
  isMac.value = navigator.platform.toUpperCase().includes('MAC')
  document.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKey)
})
</script>
