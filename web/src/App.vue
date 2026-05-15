<template>
  <div class="flex h-screen bg-surface-0 relative overflow-hidden">
    <!-- Ambient background depth system -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <!-- Primary: large top-right cyan glow — the main light source -->
      <div class="absolute -top-[30%] -right-[15%] w-[65%] h-[70%] rounded-full bg-accent/[0.03] blur-[160px]"></div>
      <!-- Secondary: bottom-left deep navy orb for balance -->
      <div class="absolute -bottom-[25%] -left-[15%] w-[55%] h-[55%] rounded-full bg-blue-900/[0.06] blur-[140px]"></div>
      <!-- Tertiary: mid-canvas indigo warmth — breaks up the flat center -->
      <div class="absolute top-[15%] left-[25%] w-[45%] h-[50%] rounded-full bg-indigo-950/[0.08] blur-[180px]"></div>
      <!-- Aurora: hairline gradient strip across the very top -->
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/[0.18] to-transparent"></div>
      <!-- Vignette: edges fade to deeper black, prevents glow bleed -->
      <div class="absolute inset-0" style="background: radial-gradient(ellipse 85% 75% at 50% 40%, transparent 45%, rgba(3, 5, 10, 0.35) 100%)"></div>
    </div>

    <AppNav />

    <main class="flex-1 overflow-auto relative z-0">
      <!-- Subtle gradient highlight at the top edge of the content pane -->
      <div class="pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent/[0.1] to-transparent z-10" aria-hidden="true"></div>
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
