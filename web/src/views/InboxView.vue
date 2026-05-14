<template>
  <div class="flex flex-col h-full p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-semibold text-txt-primary tracking-tight">Inbox</h2>
        <p class="text-xs text-txt-muted mt-0.5">Messages &amp; incoming items</p>
      </div>
      <span
        v-if="entries.length > 0"
        class="text-[10px] font-mono text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full"
      >{{ entries.length }} item{{ entries.length === 1 ? '' : 's' }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-txt-muted text-sm">
        <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
        Loading…
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="entries.length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-14 h-14 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-4">
        <svg class="w-7 h-7 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"/>
        </svg>
      </div>
      <p class="text-txt-muted text-sm font-medium">Inbox is empty</p>
      <p class="text-txt-muted/60 text-xs mt-1">No messages right now</p>
    </div>

    <!-- Entry list -->
    <ul v-else class="space-y-2 overflow-y-auto flex-1 pr-1">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="group bg-surface-2/50 border border-edge rounded-xl hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden animate-fade-in"
      >
        <!-- Card header (always visible) -->
        <div
          class="flex items-start gap-3 p-4 cursor-pointer"
          @click="toggleExpand(entry.id)"
        >
          <!-- Accent dot -->
          <div class="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm shrink-0"></div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-semibold text-txt-primary leading-snug">{{ entry.title }}</span>
              <span class="text-[10px] text-txt-muted font-mono shrink-0 mt-0.5">{{ formatTime(entry.created_at) }}</span>
            </div>
            <!-- Body preview when collapsed -->
            <p
              v-if="!expanded.has(entry.id)"
              class="text-xs text-txt-secondary mt-1 line-clamp-2 leading-relaxed"
            >{{ bodyPreview(entry.body) }}</p>
          </div>

          <!-- Delete button -->
          <button
            @click.stop="deleteEntry(entry.id)"
            :disabled="deleting.has(entry.id)"
            class="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-lg text-txt-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-30 transition-all duration-200"
            title="Delete entry"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
            </svg>
          </button>
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
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/>
      </svg>
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface InboxEntry {
  id: number
  title: string
  body: string
  created_at: string
}

const entries = ref<InboxEntry[]>([])
const loading = ref(true)
const expanded = ref(new Set<number>())
const deleting = ref(new Set<number>())
const errorMsg = ref<string | null>(null)

function formatTime(ts: string): string {
  try {
    const normalized = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z'
    return new Date(normalized).toLocaleString()
  } catch { return ts }
}

function bodyPreview(body: string): string {
  // Strip markdown syntax for a clean plain-text preview
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
    const res = await apiFetch('/api/inbox')
    if (res.ok) {
      const data = (await res.json()) as { entries: InboxEntry[] }
      entries.value = data.entries ?? []
    }
  } catch { /* best effort */ }
  loading.value = false
}

async function deleteEntry(id: number) {
  if (!window.confirm('Delete this inbox entry?')) return
  const next = new Set(deleting.value)
  next.add(id)
  deleting.value = next
  try {
    const res = await apiFetch(`/api/inbox/${id}`, { method: 'DELETE' })
    if (res.ok) {
      entries.value = entries.value.filter(e => e.id !== id)
      // Collapse if expanded
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
