<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'
import { formatRelativeTime, titleizeSlug, withAlpha, type FeedEntry } from '@/lib/mission-control'

type SquadLookup = Record<string, { name: string; universe?: string | null; color: string }>

type FeedGroup = {
  key: string
  label: string
  color: string
  entries: FeedEntry[]
}

const entries = ref<FeedEntry[]>([])
const squads = ref<SquadLookup>({})
const expandedId = ref<number | null>(null)
const loading = ref(false)

const groups = computed<FeedGroup[]>(() => {
  const grouped = new Map<string, FeedGroup>()
  for (const entry of entries.value) {
    const key = entry.squad_slug ?? 'io'
    const meta = squads.value[key]
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: meta?.name ?? titleizeSlug(key),
        color: meta?.color ?? '#8a8a99',
        entries: [],
      })
    }
    grouped.get(key)?.entries.push(entry)
  }
  return [...grouped.values()]
})

async function loadFeed() {
  loading.value = true
  try {
    const [feedResponse, squadsResponse] = await Promise.all([
      apiFetch('/api/feed?limit=120'),
      apiFetch('/api/squads'),
    ])

    if (feedResponse.ok) {
      entries.value = (await feedResponse.json() as { entries: FeedEntry[] }).entries
    }
    if (squadsResponse.ok) {
      const payload = await squadsResponse.json() as { squads: Array<{ slug?: string; id?: string; name: string; universe?: string | null; color?: string }> }
      squads.value = Object.fromEntries(payload.squads.map((squad) => [squad.slug ?? squad.id ?? squad.name.toLowerCase(), { name: squad.name, universe: squad.universe, color: squad.color ?? '#8a8a99' }]))
    }
  } finally {
    loading.value = false
  }
}

async function toggleEntry(entry: FeedEntry) {
  expandedId.value = expandedId.value === entry.id ? null : entry.id
  if (!entry.read_at) {
    await apiFetch(`/api/feed/${entry.id}/read`, { method: 'POST' }).catch(() => null)
    entry.read_at = new Date().toISOString()
  }
}

onMounted(loadFeed)
</script>

<template>
  <div class="h-full overflow-y-auto p-5">
    <div class="mx-auto max-w-4xl">
      <div class="mb-5 flex items-center justify-between gap-3">
        <div>
          <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Activity Feed</div>
          <div class="mt-2 text-sm text-foreground/70">Unread events keep the cyan indicator and expand inline for detail.</div>
        </div>
        <button class="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" @click="loadFeed">refresh</button>
      </div>

      <div v-if="loading" class="rounded-lg border border-border bg-card px-5 py-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/50">Syncing feed…</div>
      <div v-else-if="!groups.length" class="rounded-lg border border-dashed border-border bg-card/30 px-5 py-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/50">No feed activity.</div>
      <div v-else class="space-y-4">
        <section v-for="group in groups" :key="group.key" class="overflow-hidden rounded-lg border border-border bg-card">
          <div class="border-b border-border/50 px-5 py-3">
            <span class="rounded px-1.5 py-0.5 font-mono text-[10px]" :style="{ color: group.color, backgroundColor: withAlpha(group.color, 0.15) }">{{ group.label }}</span>
          </div>
          <article v-for="entry in group.entries" :key="entry.id" class="cursor-pointer border-b border-border/40 px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02]" :class="!entry.read_at ? 'bg-white/[0.015]' : ''" @click="toggleEntry(entry)">
            <div class="flex items-start gap-3">
              <div class="mt-1.5 shrink-0">
                <div v-if="!entry.read_at" class="h-1.5 w-1.5 rounded-full bg-primary" :style="{ boxShadow: 'var(--glow-cyan)' }" />
                <div v-else class="h-1.5 w-1.5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex flex-wrap items-center gap-1.5">
                  <span class="font-mono text-[10px] text-muted-foreground/50">{{ entry.source_ref ?? entry.instance_id ?? entry.task_id ?? entry.type }}</span>
                  <span class="font-mono text-[10px] text-muted-foreground/40">·</span>
                  <span class="text-[10px] text-muted-foreground/50">{{ entry.source_type ?? 'IO' }}</span>
                </div>
                <div class="mb-1 text-sm leading-snug" :class="!entry.read_at ? 'text-foreground' : 'text-foreground/70'">{{ entry.title }}</div>
                <div class="flex items-center justify-between gap-2">
                  <span class="font-mono text-[10px] text-muted-foreground/40">{{ formatRelativeTime(entry.created_at) }}</span>
                  <span v-if="entry.body" class="text-[10px] text-primary/60">{{ expandedId === entry.id ? '▲ collapse' : '▼ details' }}</span>
                </div>
                <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
                  <div v-if="expandedId === entry.id && entry.body" class="mt-3 rounded border border-white/[0.06] bg-black/30 p-3 text-xs text-foreground/60">
                    <div class="wiki-content text-xs font-mono leading-relaxed" v-html="renderMarkdown(entry.body)" />
                  </div>
                </transition>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  </div>
</template>
