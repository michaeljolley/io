<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type FeedEntry = {
  id: number
  type: string
  title: string
  body: string
  source_type?: string
  source_ref?: string
  created_at: string
  read_at?: string | null
  squad_slug?: string | null
  instance_id?: string | null
  task_id?: string | null
}

const entries = ref<FeedEntry[]>([])
const squads = ref<string[]>([])
const loading = ref(false)
const selectedIds = ref<number[]>([])
const filters = ref({
  type: '',
  squad: '',
  search: '',
  unreadOnly: false,
  limit: 80,
  offset: 0,
})

const typeOptions = ['notification', 'inbox']
const selectedCount = computed(() => selectedIds.value.length)

function borderTone(type: string) {
  if (type === 'notification') return 'border-l-cyan'
  if (type === 'inbox') return 'border-l-violet'
  return 'border-l-danger'
}

function isSelected(id: number) {
  return selectedIds.value.includes(id)
}

function toggleSelection(id: number) {
  if (isSelected(id)) {
    selectedIds.value = selectedIds.value.filter((value) => value !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

async function loadSquads() {
  const response = await apiFetch('/api/feed/squads')
  if (response.ok) {
    squads.value = (await response.json() as { squads: string[] }).squads
  }
}

async function loadEntries(reset = true) {
  loading.value = true
  if (reset) {
    filters.value.offset = 0
    selectedIds.value = []
  }

  const params = new URLSearchParams()
  if (filters.value.type) params.set('type', filters.value.type)
  if (filters.value.search) params.set('search', filters.value.search)
  if (filters.value.squad) params.set('squad', filters.value.squad)
  if (filters.value.unreadOnly) params.set('unread_only', '1')
  params.set('limit', String(filters.value.limit))
  params.set('offset', String(filters.value.offset))

  const response = await apiFetch(`/api/feed?${params.toString()}`)
  loading.value = false
  if (response.ok) {
    entries.value = (await response.json() as { entries: FeedEntry[] }).entries
  }
}

async function markEntryRead(id: number) {
  await apiFetch(`/api/feed/${id}/read`, { method: 'POST' })
  await loadEntries(false)
}

async function deleteEntry(id: number) {
  await apiFetch(`/api/feed/${id}`, { method: 'DELETE' })
  selectedIds.value = selectedIds.value.filter((value) => value !== id)
  await loadEntries(false)
}

async function readAll() {
  const suffix = filters.value.type ? `?type=${encodeURIComponent(filters.value.type)}` : ''
  await apiFetch(`/api/feed/read-all${suffix}`, { method: 'POST' })
  await loadEntries(false)
}

async function batchRead() {
  if (!selectedIds.value.length) return
  await apiFetch('/api/feed/batch-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: selectedIds.value }),
  })
  await loadEntries(false)
}

async function batchDelete() {
  if (!selectedIds.value.length) return
  await apiFetch('/api/feed/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: selectedIds.value }),
  })
  await loadEntries(false)
}

onMounted(async () => {
  await Promise.all([loadSquads(), loadEntries()])
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-surface/95">
    <div class="sticky top-0 z-10 border-b border-line bg-[#09090d]/96 px-5 py-4 backdrop-blur">
      <div class="flex flex-wrap items-center gap-3">
        <input v-model="filters.search" class="focus-ring min-w-[220px] flex-1 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white placeholder:text-slate-500" placeholder="search title, body, task id" @keydown.enter.prevent="loadEntries()" />
        <select v-model="filters.type" class="focus-ring rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-slate-200">
          <option value="">all types</option>
          <option v-for="option in typeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
        <select v-model="filters.squad" class="focus-ring rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-slate-200">
          <option value="">all squads</option>
          <option v-for="squad in squads" :key="squad" :value="squad">{{ squad }}</option>
        </select>
        <label class="flex items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-mist">
          <input v-model="filters.unreadOnly" type="checkbox" class="accent-cyan" /> unread only
        </label>
        <button class="rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan" @click="loadEntries()">refresh</button>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">
        <button class="rounded-full border border-line px-3 py-1.5 transition hover:border-cyan hover:text-cyan" @click="readAll">read all</button>
        <button class="rounded-full border border-line px-3 py-1.5 transition hover:border-cyan hover:text-cyan" :disabled="!selectedCount" @click="batchRead">mark selected read</button>
        <button class="rounded-full border border-danger/40 px-3 py-1.5 text-danger transition hover:bg-danger/10" :disabled="!selectedCount" @click="batchDelete">delete selected</button>
        <span>{{ selectedCount }} selected</span>
        <span class="text-slate-500">{{ loading ? 'syncing…' : `${entries.length} entries` }}</span>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div class="overflow-hidden rounded-[24px] border border-line bg-[#09090d]/96">
        <div class="grid grid-cols-[42px_minmax(0,1.3fr)_minmax(0,2fr)_180px_160px] border-b border-line px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">
          <div>#</div>
          <div>title</div>
          <div>body</div>
          <div>source</div>
          <div>created</div>
        </div>
        <div v-for="entry in entries" :key="entry.id" class="grid grid-cols-[42px_minmax(0,1.3fr)_minmax(0,2fr)_180px_160px] border-l-4 border-b border-line px-4 py-4 transition hover:bg-white/2" :class="borderTone(entry.type)">
          <div class="pt-1">
            <input :checked="isSelected(entry.id)" type="checkbox" class="accent-cyan" @change="toggleSelection(entry.id)" />
          </div>
          <div class="min-w-0 pr-4">
            <div class="truncate text-sm font-medium text-white">{{ entry.title }}</div>
            <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.15em]" :class="entry.read_at ? 'text-mist' : 'text-cyan'">
              {{ entry.type }} · {{ entry.read_at ? 'read' : 'unread' }}
            </div>
            <div class="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
              <button class="rounded-full border border-line px-2 py-1 transition hover:border-cyan hover:text-cyan" @click="markEntryRead(entry.id)">read</button>
              <button class="rounded-full border border-danger/40 px-2 py-1 text-danger transition hover:bg-danger/10" @click="deleteEntry(entry.id)">delete</button>
            </div>
          </div>
          <div class="min-w-0 pr-4 text-sm leading-6 text-slate-300">{{ entry.body }}</div>
          <div class="pr-4 font-mono text-xs text-mist">
            <div>{{ entry.source_type ?? 'feed' }}</div>
            <div class="mt-1 truncate text-slate-400">{{ entry.source_ref ?? entry.task_id ?? '—' }}</div>
            <div class="mt-1 text-violet">{{ entry.squad_slug ?? '—' }}</div>
          </div>
          <div class="font-mono text-xs text-mist">
            {{ new Date(entry.created_at).toLocaleString() }}
          </div>
        </div>
        <div v-if="!entries.length && !loading" class="px-4 py-16 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">no feed entries match the current filters</div>
      </div>
    </div>
  </div>
</template>
