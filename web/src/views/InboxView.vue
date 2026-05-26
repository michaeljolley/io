<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatRelativeTime } from '@/lib/mission-control'

type InboxEntry = {
  id: number
  type: string
  title: string
  body: string
  source_type?: string
  source_ref?: string
  created_at: string
  squad_slug?: string | null
}

const entries = ref<InboxEntry[]>([])
const selectedId = ref<number | null>(null)
const count = ref(0)

const selected = computed(() => entries.value.find((entry) => entry.id === selectedId.value) ?? null)

async function refresh() {
  const [countResponse, inboxResponse] = await Promise.all([
    apiFetch('/api/inbox/count'),
    apiFetch('/api/inbox'),
  ])
  if (countResponse.ok) {
    count.value = (await countResponse.json() as { count: number }).count ?? 0
  }
  if (inboxResponse.ok) {
    entries.value = (await inboxResponse.json() as { entries: InboxEntry[] }).entries
    selectedId.value = entries.value[0]?.id ?? null
  }
}

async function dismiss(id: number) {
  await apiFetch(`/api/inbox/${id}`, { method: 'DELETE' })
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <div class="grid h-full min-h-0 gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="border-b border-border px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-foreground">Inbox</div>
        <div class="mt-2 flex items-end justify-between gap-3">
          <div>
            <div class="text-3xl font-semibold">{{ count }}</div>
            <div class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground/55">active inbox entries</div>
          </div>
          <button class="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-accent-foreground/40 hover:text-accent-foreground" @click="refresh">refresh</button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button v-for="entry in entries" :key="entry.id" class="mb-2 w-full rounded-lg border px-4 py-4 text-left transition-colors" :class="selectedId === entry.id ? 'border-accent-foreground/40 bg-accent-foreground/10' : 'border-border bg-sidebar/40 hover:bg-white/[0.03]'" @click="selectedId = entry.id">
          <div class="flex items-center justify-between gap-3">
            <div class="truncate text-sm font-medium">{{ entry.title }}</div>
            <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-foreground">{{ entry.type }}</div>
          </div>
          <div class="mt-2 text-sm leading-6 text-foreground/65">{{ entry.body }}</div>
          <div class="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/55">{{ formatRelativeTime(entry.created_at) }}</div>
        </button>
        <div v-if="!entries.length" class="rounded-lg border border-dashed border-border px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/45">Inbox is empty</div>
      </div>
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="border-b border-border px-6 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Selected message</div>
        <div class="mt-2 text-lg font-semibold">{{ selected?.title ?? 'No message selected' }}</div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <template v-if="selected">
          <div class="grid gap-5 lg:grid-cols-[1fr_220px]">
            <article class="rounded-lg border border-white/[0.06] bg-sidebar/60 px-5 py-5 text-sm leading-7 text-foreground/75">{{ selected.body }}</article>
            <aside class="rounded-lg border border-white/[0.06] bg-sidebar/60 px-5 py-5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground/55">
              <div>source</div>
              <div class="mt-2 text-foreground">{{ selected.source_type ?? 'inbox' }}</div>
              <div class="mt-4">reference</div>
              <div class="mt-2 text-accent-foreground">{{ selected.source_ref ?? selected.squad_slug ?? '—' }}</div>
              <div class="mt-4">received</div>
              <div class="mt-2 text-foreground/80">{{ formatRelativeTime(selected.created_at) }}</div>
              <button class="mt-6 w-full rounded border border-destructive/40 px-4 py-2 text-destructive transition-colors hover:bg-destructive/10" @click="dismiss(selected.id)">dismiss</button>
            </aside>
          </div>
        </template>
        <div v-else class="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/45">Select a message from the left rail</div>
      </div>
    </section>
  </div>
</template>
