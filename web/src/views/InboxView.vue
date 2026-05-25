<template>
  <div class="p-5 space-y-4">
    <h1 class="text-base font-semibold text-text">Inbox</h1>
    <div v-if="loading" class="py-12 text-center text-text-muted text-sm">Loading...</div>
    <div v-else-if="error" class="text-accent-red text-sm">{{ error }}</div>
    <div v-else-if="!entries.length" class="py-12 text-center text-text-muted text-sm">Your inbox is empty</div>
    <ul v-else class="space-y-2">
      <li v-for="entry in entries" :key="entry.id" class="group bg-bg-card border border-border rounded-lg p-4 hover:border-border-bright transition-colors">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm text-text font-medium">{{ entry.title }}</p>
            <p class="text-[11px] text-text-muted font-mono mt-0.5">{{ formatDate(entry.created_at) }}</p>
          </div>
          <button @click="deleteEntry(entry.id)" :disabled="deletingIds.has(entry.id)" class="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red disabled:opacity-30 transition-all"><svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clip-rule="evenodd"/></svg></button>
        </div>
        <div v-if="entry.squad_slug || entry.instance_id || entry.task_id" class="flex flex-wrap gap-1 mt-2"><span v-if="entry.squad_slug" class="text-[10px] font-mono text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded border border-accent-cyan/20">{{ entry.squad_slug }}</span><span v-if="entry.instance_id" class="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border">inst:{{ entry.instance_id }}</span><span v-if="entry.task_id" class="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border">task:{{ entry.task_id }}</span></div>
        <div class="mt-3 text-xs text-text-secondary wiki-content" v-html="renderMarkdown(entry.body)"></div>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'

const INBOX_LAST_SEEN_KEY = 'inbox-last-seen-id'

interface InboxEntry {
  id: number
  type: string
  title: string
  body: string
  created_at: string
  read_at: string | null
  source_type: string | null
  squad_slug: string | null
  instance_id: string | null
  task_id: string | null
}

const entries = ref<InboxEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const deletingIds = ref<Set<number>>(new Set())
let pollTimer: ReturnType<typeof setInterval> | null = null

const formatDate = (value: string) => {
  if (!value) return ''
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const markSeen = (list: InboxEntry[]) => {
  if (list.length === 0) return
  const maxId = Math.max(...list.map(e => e.id))
  try { localStorage.setItem(INBOX_LAST_SEEN_KEY, String(maxId)) } catch { /* ignore */ }
}

const fetchEntries = async (initial = false) => {
  if (initial) loading.value = true
  error.value = null
  try {
    const res = await apiFetch('/api/inbox')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { entries: InboxEntry[] }
    entries.value = data.entries ?? []
    markSeen(entries.value)
  } catch (e) {
    if (initial) error.value = e instanceof Error ? e.message : 'Failed to load inbox'
  } finally {
    if (initial) loading.value = false
  }
}

const deleteEntry = async (id: number) => {
  if (deletingIds.value.has(id)) return
  deletingIds.value = new Set(deletingIds.value).add(id)
  try {
    const res = await apiFetch(`/api/inbox/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
    entries.value = entries.value.filter(e => e.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete entry'
  } finally {
    const next = new Set(deletingIds.value)
    next.delete(id)
    deletingIds.value = next
  }
}

onMounted(() => {
  fetchEntries(true)
  pollTimer = setInterval(() => fetchEntries(), 10_000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>
