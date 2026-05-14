<template>
  <div class="flex h-screen bg-surface-0 relative overflow-hidden">
    <!-- Ambient background glow -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute -top-[40%] -left-[20%] w-[60%] h-[80%] rounded-full bg-accent/[0.02] blur-[120px]"></div>
      <div class="absolute -bottom-[30%] -right-[10%] w-[50%] h-[60%] rounded-full bg-accent/[0.015] blur-[100px]"></div>
    </div>

    <AppNav />

    <main class="flex-1 overflow-auto relative z-0">
      <RouterView v-slot="{ Component }">
        <transition name="view" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppNav from './components/AppNav.vue'
import { RouterView } from 'vue-router'
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
