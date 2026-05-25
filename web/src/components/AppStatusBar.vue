<template>
  <footer class="shrink-0 h-[30px] flex items-center justify-between px-4 bg-bg-surface border-t border-border text-xs select-none">
    <!-- Left -->
    <div class="flex items-center gap-3 text-text-muted">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-accent-green"></span>
        Connected
      </span>
      <span>·</span>
      <span>{{ squadCount }} squads · {{ agentCount }} agents</span>
      <template v-if="instanceInfo">
        <span>·</span>
        <span class="text-accent-purple">{{ instanceInfo }}</span>
      </template>
    </div>
    <!-- Right -->
    <div class="flex items-center gap-1.5 text-text-muted">
      <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v4.5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V5Z" clip-rule="evenodd"/></svg>
      <span>Last sync: {{ lastSyncText }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const squadCount = ref(0)
const agentCount = ref(0)
const instanceInfo = ref('')
const lastSyncText = ref('just now')
let lastSyncTime = Date.now()
let ticker: ReturnType<typeof setInterval> | null = null

function updateSyncText() {
  const secs = Math.floor((Date.now() - lastSyncTime) / 1000)
  if (secs < 10) lastSyncText.value = 'just now'
  else if (secs < 60) lastSyncText.value = `${secs}s ago`
  else lastSyncText.value = `${Math.floor(secs / 60)}m ago`
}

async function fetchStatus() {
  try {
    const res = await apiFetch('/api/squads')
    if (res.ok) {
      const data = (await res.json()) as { squads?: Array<{ agents_count?: number; instances_active?: number; instances_total?: number }> }
      const squads = data.squads ?? []
      squadCount.value = squads.length
      agentCount.value = squads.reduce((sum, s) => sum + (s.agents_count ?? 0), 0)
      const activeInst = squads.reduce((sum, s) => sum + (s.instances_active ?? 0), 0)
      const totalInst = squads.reduce((sum, s) => sum + (s.instances_total ?? 0), 0)
      if (totalInst > 0) instanceInfo.value = `${activeInst}/${totalInst} instances active`
      else instanceInfo.value = ''
    }
  } catch { /* best effort */ }
  lastSyncTime = Date.now()
  updateSyncText()
}

onMounted(async () => {
  await auth.init()
  if (auth.authEnabled && !auth.user) return
  fetchStatus()
  ticker = setInterval(updateSyncText, 10000)
})

onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})
</script>
