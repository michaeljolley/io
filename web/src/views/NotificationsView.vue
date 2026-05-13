<template>
  <div class="flex flex-col h-full p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-gray-100">Notifications</h2>
      <button
        v-if="notifications.length > 0"
        @click="markAllRead"
        class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        Mark all as read
      </button>
    </div>

    <div v-if="loading" class="text-gray-400 text-center py-8">Loading...</div>
    <div v-else-if="notifications.length === 0" class="text-gray-500 text-center py-8">
      No notifications yet
    </div>
    <ul v-else class="space-y-2 overflow-y-auto flex-1">
      <li
        v-for="n in notifications"
        :key="n.id"
        class="bg-gray-800 border rounded-lg p-4 cursor-pointer transition-colors"
        :class="n.read_at ? 'border-gray-700 opacity-60' : 'border-blue-700'"
        @click="toggleExpand(n.id)"
      >
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span v-if="!n.read_at" class="w-2 h-2 bg-blue-400 rounded-full shrink-0"></span>
              <span class="text-sm font-medium text-gray-100 truncate">{{ n.title }}</span>
              <span class="text-xs text-gray-500">{{ n.source?.type }}</span>
            </div>
            <p class="text-xs text-gray-500">{{ formatTime(n.created_at) }}</p>
          </div>
          <button
            v-if="!n.read_at"
            @click.stop="markRead(n.id)"
            class="text-xs text-gray-400 hover:text-white shrink-0"
            title="Mark as read"
          >
            ✓
          </button>
        </div>
        <div v-if="expanded.has(n.id)" class="mt-3 text-sm text-gray-300 whitespace-pre-wrap bg-gray-900 rounded p-3 border border-gray-700">
          {{ n.text }}
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  try { return new Date(ts).toLocaleString() } catch { return ts }
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
