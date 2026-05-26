<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  active: 'skills' | 'mcp'
}>()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="shrink-0 px-4 pb-0 pt-5 md:px-6">
      <h2 class="mb-4 text-base font-semibold">Settings</h2>
      <div class="flex border-b border-border">
        <RouterLink to="/skills" class="-mb-px border-b-2 px-4 py-2 font-mono text-xs font-medium transition-colors" :class="active === 'skills' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'">
          Skills
        </RouterLink>
        <RouterLink to="/mcp" class="-mb-px border-b-2 px-4 py-2 font-mono text-xs font-medium transition-colors" :class="active === 'mcp' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'">
          MCP Servers
        </RouterLink>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-5 md:px-6">
      <slot />
    </div>
  </div>
</template>
