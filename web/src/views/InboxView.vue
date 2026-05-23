<template>
  <div class="flex flex-col h-full p-3 sm:p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-txt-primary tracking-tight">Inbox</h2>
        <p class="text-xs text-txt-muted mt-0.5">Messages delivered to you</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-4 text-sm">
      <span>⚠</span> {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading && entries.length === 0" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-txt-muted text-sm">
        <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
        Loading…
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && entries.length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-14 h-14 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-4">
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-7 h-7 text-txt-muted" aria-hidden="true">
          <path d="M2 6.25A2.25 2.25 0 0 1 4.25 4h11.5A2.25 2.25 0 0 1 18 6.25v7.5A2.25 2.25 0 0 1 15.75 16H4.25A2.25 2.25 0 0 1 2 13.75v-7.5Zm2.25-1a1 1 0 0 0-1 1v.388l6.75 4.5 6.75-4.5V6.25a1 1 0 0 0-1-1H4.25Zm12.5 2.834-6.294 4.196a.75.75 0 0 1-.812 0L3.25 8.084v5.666a1 1 0 0 0 1 1h11.5a1 1 0 0 0 1-1V8.084Z"/>
        </svg>
      </div>
      <p class="text-txt-muted text-sm font-medium">Inbox is empty</p>
      <p class="text-txt-muted/60 text-xs mt-1">New messages will appear here</p>
    </div>

    <!-- Entry list -->
    <ul v-else class="space-y-3 overflow-y-auto flex-1">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="bg-surface-2/40 border border-edge rounded-xl p-4 hover:border-edge-bright transition-all duration-150 group"
      >
        <div class="flex justify-between items-start gap-3">
          <h3 class="text-sm font-semibold text-txt-primary leading-snug">{{ entry.title }}</h3>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[10px] text-txt-muted font-mono">{{ formatDate(entry.created_at) }}</span>
            <button
              @click="deleteEntry(entry.id)"
              :disabled="deletingIds.has(entry.id)"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-txt-muted hover:text-red-400 disabled:opacity-30"
              title="Delete"
              aria-label="Delete entry"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
        <div
          class="mt-2 text-sm text-txt-secondary wiki-content prose-sm"
          v-html="renderMarkdown(entry.body)"
        ></div>
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
  title: string
  body: string
  created_at: string
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
