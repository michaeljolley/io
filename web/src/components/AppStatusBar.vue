<template>
  <div class="shrink-0 h-[30px] bg-bg-surface border-t border-border flex items-center justify-between px-4 gap-4">
    <div class="flex items-center gap-2 text-[11px] min-w-0">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
      <span class="text-text-muted">Connected</span>
      <span class="text-border-bright">·</span>
      <span class="text-text-muted">{{ squadCount }} squad{{ squadCount !== 1 ? 's' : '' }}</span>
      <span class="text-border-bright">·</span>
      <span class="text-accent-purple">{{ agentCount }} agent{{ agentCount !== 1 ? 's' : '' }}</span>
      <template v-if="instanceInfo">
        <span class="text-border-bright">·</span>
        <span class="text-text-muted truncate">{{ instanceInfo }}</span>
      </template>
    </div>
    <div class="text-[11px] text-text-muted flex items-center gap-1.5 shrink-0">
      <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clip-rule="evenodd"/></svg>
      Last sync: {{ lastSyncText }}
    </div>
  </div>
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
