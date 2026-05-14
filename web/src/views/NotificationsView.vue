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
        <div v-if="expanded.has(n.id)" class="mt-3 text-sm text-gray-300 bg-gray-900 rounded p-3 border border-gray-700 wiki-content" v-html="renderMarkdown(n.text)"></div>
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
  try {
    // SQLite CURRENT_TIMESTAMP is UTC without Z — normalize to ISO 8601 UTC
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

function inlineFormat(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-blue-300 font-mono text-xs">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      const safe = /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#')
      return `<a href="${safe ? url : '#'}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">${linkText}</a>`
    })
}

function renderMarkdown(md: string): string {
  if (!md) return ''
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let inList = false
  let codeLines: string[] = []

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList(); inCode = true; codeLines = []
      } else {
        const escaped = codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        out.push(`<pre class="bg-gray-950 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
        inCode = false; codeLines = []
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h3) { closeList(); out.push(`<h3 class="text-base font-semibold text-gray-100 mt-4 mb-1">${inlineFormat(h3[1])}</h3>`); continue }
    if (h2) { closeList(); out.push(`<h2 class="text-lg font-bold text-gray-100 mt-5 mb-2 pb-1 border-b border-gray-700">${inlineFormat(h2[1])}</h2>`); continue }
    if (h1) { closeList(); out.push(`<h1 class="text-xl font-bold text-gray-100 mt-5 mb-2">${inlineFormat(h1[1])}</h1>`); continue }

    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr class="border-gray-700 my-3" />'); continue }

    const li = line.match(/^[-*+]\s+(.+)/)
    if (li) {
      if (!inList) { out.push('<ul class="list-disc list-inside my-2 space-y-0.5 pl-2">'); inList = true }
      out.push(`<li>${inlineFormat(li[1])}</li>`)
      continue
    }

    const oli = line.match(/^\d+\.\s+(.+)/)
    if (oli) {
      if (!inList) { out.push('<ol class="list-decimal list-inside my-2 space-y-0.5 pl-2">'); inList = true }
      out.push(`<li>${inlineFormat(oli[1])}</li>`)
      continue
    }

    if (line.trim() === '') { closeList(); out.push('<div class="my-1"></div>'); continue }
    closeList()
    out.push(`<p class="my-0.5">${inlineFormat(line)}</p>`)
  }

  if (inCode && codeLines.length) {
    const escaped = codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(`<pre class="bg-gray-950 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
  }
  closeList()
  return out.join('\n')
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
