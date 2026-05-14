<template>
  <div class="flex flex-col h-full p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-semibold text-txt-primary tracking-tight">Notifications</h2>
        <p class="text-xs text-txt-muted mt-0.5">Background activity &amp; alerts</p>
      </div>
      <button
        v-if="notifications.length > 0"
        @click="markAllRead"
        class="text-xs text-accent hover:text-accent-glow transition-colors font-medium"
      >
        Mark all read
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
    <div v-else-if="notifications.length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-12 h-12 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
        </svg>
      </div>
      <p class="text-txt-muted text-sm">No notifications yet</p>
    </div>

    <!-- Notification list -->
    <ul v-else class="space-y-2 overflow-y-auto flex-1 pr-1">
      <li
        v-for="n in notifications"
        :key="n.id"
        class="group rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden"
        :class="n.read_at
          ? 'bg-surface-1/40 border-edge/50 opacity-60 hover:opacity-80'
          : 'bg-surface-2/60 border-edge hover:border-edge-bright hover:shadow-card'"
        @click="toggleExpand(n.id)"
      >
        <div class="p-4">
          <div class="flex items-start gap-3">
            <!-- Unread accent bar -->
            <div class="flex flex-col items-center pt-1">
              <span
                v-if="!n.read_at"
                class="w-2 h-2 rounded-full bg-accent shadow-glow-sm shrink-0"
              ></span>
              <span v-else class="w-2 h-2 rounded-full bg-edge shrink-0"></span>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-txt-primary truncate">{{ n.title }}</span>
                <span
                  v-if="n.source?.type"
                  class="text-[10px] font-mono tracking-wider uppercase text-txt-muted bg-surface-0/60 px-1.5 py-0.5 rounded border border-edge/50 shrink-0"
                >{{ n.source.type }}</span>
              </div>
              <p class="text-xs text-txt-muted">{{ formatTime(n.created_at) }}</p>
            </div>

            <!-- Mark read button -->
            <button
              v-if="!n.read_at"
              @click.stop="markRead(n.id)"
              class="text-txt-muted hover:text-accent shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 rounded-lg hover:bg-accent/10"
              title="Mark as read"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Expanded content -->
        <div
          v-if="expanded.has(n.id)"
          class="px-4 pb-4 pt-0"
        >
          <div class="ml-5 mt-2 text-sm text-txt-secondary bg-surface-0/60 rounded-xl p-4 border border-edge/50 wiki-content" v-html="renderMarkdown(n.text)"></div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface Notification {
  id: number
  title: string
  text: string
  source: { type: string; [k: string]: unknown }
  created_at: string
  read_at: string | null
}

const notifications = ref<Notification[]>([])
const loading = ref(true)
const expanded = ref(new Set<number>())

function formatTime(ts: string) {
  try {
    const normalized = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z'
    return new Date(normalized).toLocaleString()
  } catch { return ts }
}

function toggleExpand(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

async function loadNotifications() {
  try {
    const res = await apiFetch('/api/notifications?limit=100')
    if (res.ok) {
      const data = (await res.json()) as { notifications: Notification[] }
      notifications.value = data.notifications ?? []
    }
  } catch { /* best effort */ }
  loading.value = false
}

async function markRead(id: number) {
  try {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
    const n = notifications.value.find(x => x.id === id)
    if (n) n.read_at = new Date().toISOString()
  } catch { /* best effort */ }
}

async function markAllRead() {
  try {
    await apiFetch('/api/notifications/read-all', { method: 'POST' })
    for (const n of notifications.value) {
      if (!n.read_at) n.read_at = new Date().toISOString()
    }
  } catch { /* best effort */ }
}

onMounted(loadNotifications)
</script>
