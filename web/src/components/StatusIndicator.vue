<script setup lang="ts">
withDefaults(defineProps<{ status: 'idle' | 'working' | 'error' | 'success' }>(), {
  status: 'idle',
})
</script>

<template>
  <div class="relative flex h-3 w-3 shrink-0 items-center justify-center">
    <template v-if="status === 'working'">
      <div class="status-working-ring absolute h-3 w-3 rounded-full bg-status-working" :style="{ boxShadow: 'var(--glow-success)' }" />
      <div class="h-2 w-2 rounded-full bg-status-working" :style="{ boxShadow: 'var(--glow-success)' }" />
    </template>
    <div v-else-if="status === 'error'" class="status-error-dot h-2 w-2 rounded-full bg-status-error" :style="{ boxShadow: 'var(--glow-error)' }" />
    <div v-else-if="status === 'success'" class="h-2 w-2 rounded-full bg-status-success" :style="{ boxShadow: 'var(--glow-success)' }" />
    <div v-else class="h-2 w-2 rounded-full bg-status-idle opacity-40" />
  </div>
</template>
