<template>
  <div class="p-5 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-base font-semibold text-text">Activity Feed</h1>
        <p class="text-xs text-text-muted mt-1">Recent notifications across IO.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <button @click="markAllRead" class="text-xs px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated transition-colors">Mark all read</button>
        <button @click="groupByTeam = !groupByTeam" class="text-xs px-2.5 py-1 rounded-md border transition-colors" :class="groupByTeam ? 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/5' : 'border-border text-text-muted hover:text-text hover:bg-bg-elevated'">Group by team</button>
        <button @click="toggleSelectMode" class="text-xs px-2.5 py-1 rounded-md border transition-colors" :class="selectMode ? 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/5' : 'border-border text-text-muted hover:text-text hover:bg-bg-elevated'">{{ selectMode ? 'Done selecting' : 'Select' }}</button>
      </div>
    </div>
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/></svg>
      <input v-model="searchQuery" placeholder="Search feed..." class="w-full bg-bg-elevated border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" />
      <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-base leading-none">&times;</button>
    </div>
    <div v-if="selectMode" class="flex items-center justify-between gap-2 bg-bg-card border border-border rounded-lg px-3 py-2">
      <div class="flex items-center gap-2 text-xs text-text-muted"><button @click="toggleSelectAll" class="text-accent-cyan hover:text-accent-cyan/80">{{ allSelected ? 'Clear selection' : 'Select all' }}</button><span>·</span><span>{{ selected.size }} selected</span></div>
      <div class="flex items-center gap-2"><button @click="bulkMarkRead" :disabled="!selected.size || bulkWorking" class="text-xs px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated disabled:opacity-40 transition-colors">Mark read</button><button @click="bulkDelete" :disabled="!selected.size || bulkWorking" class="text-xs px-2.5 py-1 rounded-md border border-accent-red/30 text-accent-red hover:bg-accent-red/10 disabled:opacity-40 transition-colors">Delete</button></div>
    </div>
    <div v-if="loading" class="py-12 text-center text-text-muted text-sm">Loading...</div>
    <div v-else-if="errorMsg" class="text-accent-red text-sm">{{ errorMsg }}</div>
    <template v-else-if="groupByTeam">
      <div v-for="group in groupedEntries" :key="group.key" class="space-y-1.5">
        <button @click="toggleGroup(group.key)" class="flex items-center gap-2 text-xs text-text-muted hover:text-text transition-colors w-full text-left"><svg :class="collapsedGroups.has(group.key) ? '' : 'rotate-90'" class="w-3 h-3 transition-transform shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg><span class="font-mono text-text-secondary">{{ group.label }}</span><span class="text-text-muted">({{ group.entries.length }})</span></button>
        <div v-if="!collapsedGroups.has(group.key)" class="pl-5 space-y-1"><FeedEntryCard v-for="entry in group.entries" :key="entry.id" :entry="entry" :select-mode="selectMode" :selected="selected.has(entry.id)" :expanded="expanded.has(entry.id)" :unread="!entry.read_at" :deleting="deleting.has(entry.id)" @select="toggleSelect(entry.id)" @expand="toggleExpand(entry.id)" @read="markRead(entry.id)" @delete="deleteEntry(entry.id)" /></div>
      </div>
      <div v-if="!groupedEntries.length" class="py-12 text-center text-text-muted text-sm">No entries</div>
    </template>
    <template v-else>
      <div class="space-y-1"><FeedEntryCard v-for="entry in filtered" :key="entry.id" :entry="entry" :select-mode="selectMode" :selected="selected.has(entry.id)" :expanded="expanded.has(entry.id)" :unread="!entry.read_at" :deleting="deleting.has(entry.id)" @select="toggleSelect(entry.id)" @expand="toggleExpand(entry.id)" @read="markRead(entry.id)" @delete="deleteEntry(entry.id)" /></div>
      <div v-if="!filtered.length" class="py-12 text-center text-text-muted text-sm">No entries</div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import FeedEntryCard from '../components/FeedEntryCard.vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface FeedEntry {
  id: number
  type: 'inbox' | 'notification'
  title: string
  body: string
  source_type: string | null
  source_ref: string | null
  created_at: string
  read_at: string | null
  squad_slug: string | null
  instance_id: string | null
  task_id: string | null
  source?: { type?: string; [k: string]: unknown }
}

const entries = ref<FeedEntry[]>([])
const loading = ref(true)
const expanded = ref(new Set<number>())
const deleting = ref(new Set<number>())
const errorMsg = ref<string | null>(null)

// Search
const searchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Group by team
const groupByTeam = ref(false)
const collapsedGroups = ref(new Set<string>())

// Bulk select state
const selectMode = ref(false)
const selected = ref(new Set<number>())
const bulkWorking = ref(false)

/** Extract squad slug from "[slug] title" format, or null if not present. */
function extractSquad(title: string): string | null {
  const m = title.match(/^\[([^\]]+)\]/)
  return m ? m[1] : null
}

const filtered = computed(() => {
  return entries.value
})

const groupedEntries = computed(() => {
  const map = new Map<string, FeedEntry[]>()
  for (const entry of filtered.value) {
    const key = extractSquad(entry.title) ?? '__ungrouped__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  const groups: { key: string; label: string; entries: FeedEntry[] }[] = []
  for (const [key, groupEntries] of map) {
    groups.push({ key, label: key === '__ungrouped__' ? 'Ungrouped' : key, entries: groupEntries })
  }
  groups.sort((a, b) => {
    if (a.key === '__ungrouped__') return 1
    if (b.key === '__ungrouped__') return -1
    return a.key.localeCompare(b.key)
  })
  return groups
})

const allSelected = computed(() =>
  filtered.value.length > 0 && filtered.value.every(e => selected.value.has(e.id))
)

function formatTime(ts: string): string {
  try {
    const normalized = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z'
    return new Date(normalized).toLocaleString()
  } catch { return ts }
}

function bodyPreview(body: string): string {
  return body.replace(/[#*`_~[\]()]/g, '').slice(0, 200)
}

function toggleExpand(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selected.value = new Set()
}

function toggleSelect(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(filtered.value.map(e => e.id))
  }
}

function toggleGroup(key: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

async function loadEntries(search?: string) {
  loading.value = true
  errorMsg.value = null
  try {
    const params = new URLSearchParams({ limit: '100', type: 'notification' })
    if (search) params.set('search', search)
    const res = await apiFetch(`/api/feed?${params}`)
    if (res.ok) {
      const data = (await res.json()) as { entries: FeedEntry[] }
      entries.value = data.entries ?? []
    }
  } catch { /* best effort */ }
  loading.value = false
}

async function markRead(id: number) {
  try {
    await apiFetch(`/api/feed/${id}/read`, { method: 'POST' })
    const entry = entries.value.find(e => e.id === id)
    if (entry) entry.read_at = new Date().toISOString()
  } catch { /* best effort */ }
}

async function markAllRead() {
  try {
    await apiFetch('/api/feed/read-all?type=notification', { method: 'POST' })
    const now = new Date().toISOString()
    for (const e of entries.value) {
      if (!e.read_at) {
        e.read_at = now
      }
    }
  } catch { /* best effort */ }
}

async function deleteEntry(id: number) {
  if (!window.confirm('Delete this entry?')) return
  const next = new Set(deleting.value)
  next.add(id)
  deleting.value = next
  try {
    const res = await apiFetch(`/api/feed/${id}`, { method: 'DELETE' })
    if (res.ok) {
      entries.value = entries.value.filter(e => e.id !== id)
      const nextExpanded = new Set(expanded.value)
      nextExpanded.delete(id)
      expanded.value = nextExpanded
    } else {
      errorMsg.value = `Failed to delete entry (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    const nextDel = new Set(deleting.value)
    nextDel.delete(id)
    deleting.value = nextDel
  }
}

async function bulkMarkRead() {
  const ids = Array.from(selected.value)
  if (ids.length === 0) return
  bulkWorking.value = true
  try {
    const res = await apiFetch('/api/feed/batch-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      const now = new Date().toISOString()
      for (const e of entries.value) {
        if (ids.includes(e.id)) e.read_at = e.read_at ?? now
      }
      selected.value = new Set()
    } else {
      errorMsg.value = `Bulk mark-read failed (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Bulk mark-read failed'
  } finally {
    bulkWorking.value = false
  }
}

async function bulkDelete() {
  const ids = Array.from(selected.value)
  if (ids.length === 0) return
  if (!window.confirm(`Delete ${ids.length} item${ids.length === 1 ? '' : 's'}?`)) return
  bulkWorking.value = true
  try {
    const res = await apiFetch('/api/feed/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      entries.value = entries.value.filter(e => !ids.includes(e.id))
      const nextExpanded = new Set(expanded.value)
      ids.forEach(id => nextExpanded.delete(id))
      expanded.value = nextExpanded
      selected.value = new Set()
    } else {
      errorMsg.value = `Bulk delete failed (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Bulk delete failed'
  } finally {
    bulkWorking.value = false
  }
}

// Debounce search: reload entries 300ms after the user stops typing
watch(searchQuery, (val) => {
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    loadEntries(val.trim() || undefined)
  }, 300)
})

onMounted(() => loadEntries())
</script>
