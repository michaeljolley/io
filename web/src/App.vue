<template>
  <div v-if="route.name === 'login'" class="h-screen">
    <RouterView />
  </div>
  <div v-else class="flex flex-col h-screen bg-bg-app text-text overflow-hidden">
    <!-- Header -->
    <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <!-- Main area -->
    <div class="flex flex-1 min-h-0">
      <AppSidebar :visible="sidebarOpen" @navigate="sidebarOpen = false" />
      <main class="flex-1 overflow-auto relative">
        <RouterView v-slot="{ Component }">
          <transition name="view" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
    <!-- Status bar -->
    <AppStatusBar />
    <!-- Command bar (floating) -->
    <CommandBar :chat-open="chatRef?.isOpen ?? false" @open="chatRef?.open()" />
    <!-- Chat overlay -->
    <FloatingChat ref="chatRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import AppStatusBar from './components/AppStatusBar.vue'
import CommandBar from './components/CommandBar.vue'
import FloatingChat from './components/FloatingChat.vue'

const route = useRoute()
const sidebarOpen = ref(false)
const chatRef = ref<InstanceType<typeof FloatingChat> | null>(null)
</script>

<style scoped>
.view-enter-active {
  animation: viewIn 0.2s ease-out;
}
.view-leave-active {
  animation: viewIn 0.15s ease-in reverse;
}
@keyframes viewIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
