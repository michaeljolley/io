<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import WikiTreeNode from '@/components/WikiTreeNode.vue'
import { apiFetch } from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'
import { buildWikiTree, type WikiPageSummary } from '@/lib/mission-control'

type WikiDetail = {
  path: string
  content: string
}

const pages = ref<WikiPageSummary[]>([])
const selectedPath = ref('')
const detail = ref<WikiDetail | null>(null)
const query = ref('')

const filteredPages = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return pages.value
  return pages.value.filter((page) => `${page.path} ${page.title}`.toLowerCase().includes(needle))
})

const tree = computed(() => buildWikiTree(filteredPages.value))

async function loadPages() {
  const response = await apiFetch('/api/wiki')
  if (!response.ok) return
  pages.value = (await response.json() as { pages: WikiPageSummary[] }).pages
  if (!selectedPath.value && pages.value[0]) {
    selectedPath.value = pages.value[0].path
  }
}

async function loadDetail(path: string) {
  if (!path) return
  const response = await apiFetch(`/api/wiki/${encodeURIComponent(path)}`)
  if (!response.ok) return
  detail.value = await response.json() as WikiDetail
}

watch(selectedPath, (path) => {
  loadDetail(path)
})

onMounted(loadPages)
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <aside class="w-52 shrink-0 overflow-y-auto border-r border-border px-2 py-4">
      <input v-model="query" class="mb-3 w-full rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35" placeholder="Filter pages" />
      <WikiTreeNode v-for="node in tree" :key="node.id" :node="node" :selected-path="selectedPath" @select="selectedPath = $event" />
    </aside>

    <section class="flex-1 overflow-y-auto">
      <div v-if="detail" class="max-w-2xl px-8 py-6">
        <h2 class="mb-5 text-xl font-semibold">{{ detail.path }}</h2>
        <div class="wiki-content" v-html="renderMarkdown(detail.content)" />
      </div>
      <div v-else class="flex h-full items-center justify-center font-mono text-sm text-muted-foreground/40">Select an article</div>
    </section>
  </div>
</template>
