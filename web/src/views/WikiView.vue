<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'

type WikiPage = {
  path: string
  title: string
}

type WikiDetail = {
  path: string
  content: string
}

const pages = ref<WikiPage[]>([])
const selectedPath = ref('')
const detail = ref<WikiDetail | null>(null)
const query = ref('')

const filteredPages = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return pages.value
  return pages.value.filter((page) => `${page.path} ${page.title}`.toLowerCase().includes(needle))
})

async function loadPages() {
  const response = await apiFetch('/api/wiki')
  if (response.ok) {
    pages.value = (await response.json() as { pages: WikiPage[] }).pages
    if (!selectedPath.value && pages.value[0]) {
      selectedPath.value = pages.value[0].path
    }
  }
}

async function loadDetail(path: string) {
  if (!path) return
  const response = await apiFetch(`/api/wiki/${encodeURIComponent(path)}`)
  if (response.ok) {
    detail.value = await response.json() as WikiDetail
  }
}

watch(selectedPath, (path) => {
  loadDetail(path)
})

onMounted(loadPages)
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-surface/95">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">wiki index</div>
        <input v-model="query" class="focus-ring mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white placeholder:text-slate-500" placeholder="filter page path or title" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          v-for="page in filteredPages"
          :key="page.path"
          class="mb-2 w-full rounded-[22px] border px-4 py-3 text-left transition"
          :class="selectedPath === page.path ? 'border-cyan bg-cyan/10' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
          @click="selectedPath = page.path"
        >
          <div class="text-sm font-medium text-white">{{ page.title }}</div>
          <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{{ page.path }}</div>
        </button>
      </div>
    </section>

    <section class="min-h-0 overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">{{ detail?.path ?? 'select a wiki page' }}</div>
      </div>
      <div class="wiki-content h-full overflow-y-auto px-6 py-6" v-html="renderMarkdown(detail?.content ?? '# Wiki\n\nSelect a page to render content.')" />
    </section>
  </div>
</template>
