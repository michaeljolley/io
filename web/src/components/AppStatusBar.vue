<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type StatusPayload = {
  version?: string
  skills?: number
  squads?: number
  instances?: number
  uptime?: number
}

const status = ref<StatusPayload>({})
const state = ref('syncing')
let timer = 0

function formatUptime(value?: number) {
  const total = Math.max(0, Math.floor(value ?? 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

async function refresh() {
  try {
    const response = await apiFetch('/api/status')
    if (!response.ok) throw new Error('status failed')
    status.value = await response.json() as StatusPayload
    state.value = 'online'
  } catch {
    state.value = 'offline'
  }
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 20000)
})

onUnmounted(() => {
  window.clearInterval(timer)
})
</script>

<template>
  <footer class="border-t border-line/80 bg-[#09090d]/95 px-4 py-2">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" :class="state === 'online' ? 'animate-pulse-line bg-success' : state === 'offline' ? 'bg-danger' : 'bg-cyan'" />
        <span>{{ state }}</span>
      </div>
      <div>version <span class="text-slate-100">{{ status.version ?? '—' }}</span></div>
      <div>skills <span class="text-cyan">{{ status.skills ?? '—' }}</span></div>
      <div>squads <span class="text-violet">{{ status.squads ?? '—' }}</span></div>
      <div>instances <span class="text-white">{{ status.instances ?? '—' }}</span></div>
      <div>uptime <span class="text-success">{{ formatUptime(status.uptime) }}</span></div>
    </div>
  </footer>
</template>
