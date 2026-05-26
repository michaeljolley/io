<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppStatusBar from '@/components/AppStatusBar.vue'
import CommandBar from '@/components/CommandBar.vue'
import FloatingChat from '@/components/FloatingChat.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const commandOpen = ref(false)
const floatingChat = ref<{ open: () => void } | null>(null)
const shellVisible = computed(() => route.path !== '/login' && auth.isAuthenticated)

function openChat() {
  floatingChat.value?.open()
}

function handleShortcuts(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if ((event.metaKey || event.ctrlKey) && key == 'k') {
    event.preventDefault()
    commandOpen.value = !commandOpen.value
  }
  if ((event.metaKey || event.ctrlKey) && key === '.') {
    event.preventDefault()
    openChat()
  }
}

onMounted(() => {
  auth.init()
  window.addEventListener('keydown', handleShortcuts)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleShortcuts)
})
</script>

<template>
  <div class="relative h-full overflow-hidden bg-obsidian text-ink">
    <div class="pointer-events-none absolute inset-0 bg-grid bg-[size:48px_48px] opacity-[0.04]" />
    <div class="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-cyan/10 via-violet/5 to-transparent" />

    <template v-if="shellVisible">
      <div class="relative flex h-full overflow-hidden">
        <AppSidebar />
        <div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader @open-command="commandOpen = true" @open-chat="openChat" />
          <div class="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-2">
            <RouterView />
          </div>
          <AppStatusBar />
        </div>
      </div>
      <CommandBar :open="commandOpen" @close="commandOpen = false" @open-chat="openChat" />
      <FloatingChat ref="floatingChat" />
    </template>

    <div v-else class="relative h-full">
      <RouterView />
    </div>
  </div>
</template>
