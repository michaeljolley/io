<template>
  <div class="flex flex-col h-full p-3 sm:p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-xl font-semibold text-txt-primary tracking-tight">Feed</h2>
        <p class="text-xs text-txt-muted mt-0.5">Messages, results &amp; notifications</p>
      </div>
      <button
        v-if="entries.length > 0"
        @click="markAllRead"
        class="text-xs text-accent hover:text-accent-glow transition-colors font-medium"
      >
        Mark all read
      </button>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-1.5 mb-4 p-1 bg-surface-2/50 rounded-xl border border-edge">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="activeTab = tab.value"
        class="flex-1 text-xs font-medium py-1.5 px-3 rounded-lg transition-all duration-150"
        :class="activeTab === tab.value
          ? 'bg-accent/10 text-accent border border-accent/20'
          : 'text-txt-muted hover:text-txt-secondary hover:bg-surface-3/50 border border-transparent'"
      >
        {{ tab.label }}
        <span
          v-if="tab.value !== 'all' && tabCount(tab.value) > 0"
          class="ml-1 font-mono text-[10px] opacity-70"
        >({{ tabCount(tab.value) }})</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-txt-muted text-sm">
        <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
        Loading…
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-14 h-14 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-4">
        <FluentIcon
          :paths='`<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>`'
          :size="28"
          class="text-txt-muted"
        />
      </div>
      <p class="text-txt-muted text-sm font-medium">Nothing here yet</p>
      <p class="text-txt-muted/60 text-xs mt-1">
        {{ activeTab === 'all' ? 'Your feed is empty' : activeTab === 'deliverable' ? 'No deliverables' : 'No notifications' }}
      </p>
    </div>

    <!-- Entry list -->
    <ul v-else class="space-y-2 overflow-y-auto flex-1 pr-1">
      <li
        v-for="entry in filtered"
        :key="entry.id"
        class="group bg-surface-2/50 border border-edge rounded-xl hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden animate-fade-in"
        :class="entry.read_at ? '' : 'glow-inner'"
      >
        <!-- Card header -->
        <div
          class="flex items-start gap-3 p-4 cursor-pointer"
          @click="toggleExpand(entry.id)"
        >
          <!-- Type icon -->
          <div class="mt-0.5 shrink-0">
            <FluentIcon
              v-if="entry.type === 'deliverable'"
              :paths='`<path d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm10 7h-3.5a.5.5 0 0 0-.5.5v.01a1.75 1.75 0 0 1-.03.3c-.04.2-.1.46-.23.72-.13.25-.3.49-.57.66-.26.18-.63.31-1.17.31-.54 0-.9-.13-1.17-.3a1.7 1.7 0 0 1-.57-.67A2.57 2.57 0 0 1 8 10.5v-.01a.5.5 0 0 0-.5-.5H4V6c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v4ZM4 11h3.05c.05.26.14.62.32.97.18.38.47.76.9 1.06.45.29 1.02.47 1.73.47s1.28-.18 1.72-.47c.44-.3.73-.68.91-1.06.18-.35.27-.7.32-.97H16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z"/>`'
              :size="16"
              :class="entry.read_at ? 'text-txt-muted' : 'text-accent'"
            />
            <FluentIcon
              v-else
              :paths='`<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>`'
              :size="16"
              :class="entry.read_at ? 'text-txt-muted' : 'text-accent'"
            />
          </div>

          <!-- Unread dot -->
          <span
            v-if="!entry.read_at"
            class="mt-2 w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm shrink-0"
          ></span>
          <span v-else class="mt-2 w-1.5 h-1.5 rounded-full bg-edge shrink-0"></span>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-sm font-semibold text-txt-primary truncate leading-snug">{{ entry.title }}</span>
              <span
                v-if="entry.source_type"
                class="text-[10px] font-mono tracking-wider uppercase text-txt-muted bg-surface-0/60 px-1.5 py-0.5 rounded border border-edge/50 shrink-0"
              >{{ entry.source_type }}</span>
            </div>
            <p class="text-[10px] text-txt-muted mb-1">{{ formatTime(entry.created_at) }}</p>
            <!-- Body preview when collapsed -->
            <p
              v-if="!expanded.has(entry.id)"
              class="text-xs text-txt-secondary line-clamp-2 leading-relaxed"
            >{{ bodyPreview(entry.body) }}</p>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <!-- Mark read -->
            <button
              v-if="!entry.read_at"
              @click.stop="markRead(entry.id)"
              class="p-1.5 rounded-lg text-txt-muted hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-150"
              title="Mark as read"
            >
              <FluentIcon :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="14" />
            </button>
            <!-- Delete -->
            <button
              @click.stop="deleteEntry(entry.id)"
              :disabled="deleting.has(entry.id)"
              class="p-1.5 rounded-lg text-txt-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-30 transition-all duration-150"
              title="Delete"
            >
              <FluentIcon :paths='`<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>`' :size="14" />
            </button>
          </div>
        </div>

        <!-- Expanded markdown body -->
        <div v-if="expanded.has(entry.id)" class="px-4 pb-4">
          <div
            class="text-sm text-txt-secondary bg-surface-0/60 rounded-xl p-4 border border-edge/50 wiki-content leading-relaxed"
            v-html="renderMarkdown(entry.body)"
          ></div>
        </div>
      </li>
    </ul>

    <!-- Error banner -->
    <div
      v-if="errorMsg"
      class="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5"
    >
      <FluentIcon :paths='`<path d="m4.09 4.22.06-.07a.5.5 0 0 1 .63-.06l.07.06L10 9.29l5.15-5.14a.5.5 0 0 1 .63-.06l.07.06c.18.17.2.44.06.63l-.06.07L10.71 10l5.14 5.15c.18.17.2.44.06.63l-.06.07a.5.5 0 0 1-.63.06l-.07-.06L10 10.71l-5.15 5.14a.5.5 0 0 1-.63.06l-.07-.06a.5.5 0 0 1-.06-.63l.06-.07L9.29 10 4.15 4.85a.5.5 0 0 1-.06-.63l.06-.07-.06.07Z"/>`' :size="16" class="shrink-0" />
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface FeedEntry {
  id: number
  type: 'deliverable' | 'notification'
  title: string
  body: string
  source_type: string | null
  source_ref: string | null
  created_at: string
  read_at: string | null
  source?: { type?: string; [k: string]: unknown }
}

type TabValue = 'all' | 'deliverable' | 'notification'

const tabs: { label: string; value: TabValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Deliverables', value: 'deliverable' },
  { label: 'Notifications', value: 'notification' },
]

const entries = ref<FeedEntry[]>([])
const loading = ref(true)
const activeTab = ref<TabValue>('all')
const expanded = ref(new Set<number>())
const deleting = ref(new Set<number>())
const errorMsg = ref<string | null>(null)

const filtered = computed(() => {
  if (activeTab.value === 'all') return entries.value
  return entries.value.filter(e => e.type === activeTab.value)
})

function tabCount(type: TabValue): number {
  return entries.value.filter(e => e.type === type).length
}

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

async function loadEntries() {
  loading.value = true
  errorMsg.value = null
  try {
    const res = await apiFetch('/api/feed?limit=100')
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
  const typeParam = activeTab.value !== 'all' ? `?type=${activeTab.value}` : ''
  try {
    await apiFetch(`/api/feed/read-all${typeParam}`, { method: 'POST' })
    const now = new Date().toISOString()
    for (const e of entries.value) {
      if (!e.read_at && (activeTab.value === 'all' || e.type === activeTab.value)) {
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

onMounted(loadEntries)
</script>
