<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

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
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-violet/35 bg-surface/95 shadow-violet">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">message center</div>
        <div class="mt-2 flex items-end justify-between gap-3">
          <div>
            <div class="text-3xl font-semibold text-white">{{ count }}</div>
            <div class="font-mono text-xs uppercase tracking-[0.18em] text-mist">active inbox entries</div>
          </div>
          <button class="rounded-2xl border border-line bg-panel px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-mist transition hover:border-violet hover:text-violet" @click="refresh">refresh</button>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          v-for="entry in entries"
          :key="entry.id"
          class="mb-2 w-full rounded-[22px] border px-4 py-4 text-left transition"
          :class="selectedId === entry.id ? 'border-violet bg-violet/12' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
          @click="selectedId = entry.id"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="truncate text-sm font-medium text-white">{{ entry.title }}</div>
            <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-violet">{{ entry.type }}</div>
          </div>
          <div class="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{{ entry.body }}</div>
          <div class="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{{ new Date(entry.created_at).toLocaleString() }}</div>
        </button>
        <div v-if="!entries.length" class="rounded-[22px] border border-dashed border-line px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.24em] text-mist">inbox is empty</div>
      </div>
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
      <div class="border-b border-line px-6 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">selected message</div>
        <div class="mt-2 text-2xl font-semibold text-white">{{ selected?.title ?? 'No message selected' }}</div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <template v-if="selected">
          <div class="grid gap-5 lg:grid-cols-[1fr_220px]">
            <article class="rounded-[24px] border border-line bg-panel px-5 py-5 text-sm leading-7 text-slate-200">
              {{ selected.body }}
            </article>
            <aside class="rounded-[24px] border border-line bg-surface px-5 py-5 font-mono text-xs uppercase tracking-[0.18em] text-mist">
              <div>source</div>
              <div class="mt-2 text-white">{{ selected.source_type ?? 'inbox' }}</div>
              <div class="mt-4">reference</div>
              <div class="mt-2 text-violet">{{ selected.source_ref ?? selected.squad_slug ?? '—' }}</div>
              <div class="mt-4">received</div>
              <div class="mt-2 text-slate-200">{{ new Date(selected.created_at).toLocaleString() }}</div>
              <button class="mt-6 w-full rounded-2xl border border-danger/40 px-4 py-3 text-danger transition hover:bg-danger/10" @click="dismiss(selected.id)">
                dismiss
              </button>
            </aside>
          </div>
        </template>
        <div v-else class="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.24em] text-mist">select a message from the left rail</div>
      </div>
    </section>
  </div>
</template>
