<template>
  <Transition name="cmdbar">
    <div v-if="!props.chatOpen" class="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 w-[360px]">
      <button @click="openChat" class="w-full flex items-center gap-2.5 bg-bg-surface border border-border rounded-full px-4 py-2 text-text-muted hover:border-border-bright hover:text-text transition-colors cursor-text group">
        <svg class="w-3.5 h-3.5 shrink-0 text-text-muted group-hover:text-accent-cyan transition-colors" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/></svg>
        <span class="flex-1 text-left text-sm">Command IO...</span>
        <kbd class="text-[10px] font-mono bg-bg-elevated border border-border rounded px-1.5 py-0.5 text-text-muted">{{ isMac ? '⌘K' : 'Ctrl K' }}</kbd>
      </button>
    </div>
  </Transition>
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

<style scoped>
.cmdbar-enter-active, .cmdbar-leave-active { transition: opacity 0.15s, transform 0.15s; }
.cmdbar-enter-from, .cmdbar-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
