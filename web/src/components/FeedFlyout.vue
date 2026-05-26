<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
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

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const entries = ref<FeedEntry[]>([])
const squads = ref<SquadLookup>({})
const expandedId = ref<number | null>(null)
const loading = ref(false)

const groupedEntries = computed<FeedGroup[]>(() => {
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

async function refresh() {
  loading.value = true
  try {
    const [feedResponse, squadsResponse] = await Promise.all([
      apiFetch('/api/feed?limit=80'),
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

watch(() => props.open, (value) => {
  if (value) {
    refresh()
  } else {
    expandedId.value = null
  }
})
</script>

<template>
  <teleport to="body">
    <transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" @click="emit('close')" />
    </transition>

    <transition enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition-transform duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="open" class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-sidebar md:w-[420px]">
        <div class="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div class="flex items-center gap-2">
            <AppIcon name="message" class="h-4 w-4 text-primary" />
            <span class="text-sm font-semibold">Activity Feed</span>
            <span v-if="entries.filter((entry) => !entry.read_at).length" class="rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">{{ entries.filter((entry) => !entry.read_at).length }}</span>
          </div>
          <button class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" @click="emit('close')">
            <AppIcon name="x" class="h-4 w-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div v-if="loading" class="px-5 py-8 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/50">Syncing feed…</div>
          <div v-else-if="!groupedEntries.length" class="px-5 py-8 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/50">No feed activity.</div>
          <div v-else>
            <section v-for="group in groupedEntries" :key="group.key" class="border-b border-border/40 last:border-b-0">
              <div class="sticky top-0 z-10 border-b border-border/40 bg-sidebar/95 px-5 py-2 backdrop-blur">
                <span class="rounded px-1.5 py-0.5 font-mono text-[10px]" :style="{ color: group.color, backgroundColor: withAlpha(group.color, 0.15) }">{{ group.label }}</span>
              </div>
              <div>
                <article v-for="entry in group.entries" :key="entry.id" class="cursor-pointer px-5 py-3.5 transition-colors hover:bg-white/[0.02]" :class="!entry.read_at ? 'bg-white/[0.015]' : ''" @click="toggleEntry(entry)">
                  <div class="flex items-start gap-3">
                    <div class="mt-1.5 shrink-0">
                      <div v-if="!entry.read_at" class="h-1.5 w-1.5 rounded-full bg-primary" :style="{ boxShadow: 'var(--glow-cyan)' }" />
                      <div v-else class="h-1.5 w-1.5" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-1">
                        <h4 class="text-xs font-medium leading-tight text-foreground">{{ entry.title }}</h4>
                        <span class="shrink-0 font-mono text-[9px] text-muted-foreground/40">{{ formatRelativeTime(entry.created_at) }}</span>
                      </div>
                      <div v-if="entry.body" class="mt-1 max-w-xs text-[11px] leading-relaxed text-foreground/50">{{ entry.body.slice(0, 200) }}</div>
                    </div>
                  </div>
                  <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
                    <div v-if="expandedId === entry.id && entry.body" class="mt-2 rounded border border-white/[0.06] bg-white/[0.03] p-3">
                      <div class="wiki-content text-xs" v-html="renderMarkdown(entry.body)" />
                    </div>
                  </transition>
                </article>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </transition>
  </teleport>
</template>
