<template>
  <div class="h-full p-5">
    <div class="h-full flex bg-bg-card border border-border rounded-lg overflow-hidden">
      <div class="w-56 shrink-0 border-r border-border flex flex-col bg-bg-surface">
        <div class="p-3 border-b border-border"><input v-model="search" placeholder="Filter pages..." class="w-full bg-bg-elevated border border-border rounded-md px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /></div>
        <div class="flex-1 overflow-y-auto py-1">
          <div v-if="loadingList" class="px-4 py-3 text-text-muted text-xs">Loading...</div>
          <div v-else-if="listError" class="px-4 py-3 text-accent-red text-xs">{{ listError }}</div>
          <button v-for="page in filteredPages" :key="page.path" @click="selectPage(page)" class="w-full text-left px-4 py-2 text-xs transition-colors truncate" :class="selectedPage?.path === page.path ? 'text-accent-cyan bg-bg-elevated' : 'text-text-muted hover:text-text hover:bg-bg-elevated'">{{ page.title }}</button>
          <div v-if="!loadingList && !filteredPages.length" class="px-4 py-3 text-text-muted text-xs">No pages</div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <div v-if="!selectedPage" class="h-full flex items-center justify-center text-text-muted text-sm">Select a page</div>
        <div v-else-if="loadingContent" class="text-text-muted text-sm">Loading...</div>
        <div v-else-if="contentError" class="text-accent-red text-sm">{{ contentError }}</div>
        <div v-else class="wiki-content max-w-3xl" v-html="renderedContent"></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface WikiPage {
  path: string
  title: string
}

interface WikiPageContent {
  path: string
  content: string
}

const pages = ref<WikiPage[]>([])
const selectedPage = ref<WikiPage | null>(null)
const content = ref<string>('')
const search = ref('')
const loadingList = ref(false)
const loadingContent = ref(false)
const listError = ref('')
const contentError = ref('')

const filteredPages = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return pages.value
  return pages.value.filter(p => p.title.toLowerCase().includes(q))
})

const renderedContent = computed(() => renderMarkdown(content.value))

async function fetchPages() {
  loadingList.value = true
  listError.value = ''
  try {
    const res = await apiFetch('/api/wiki')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { pages: WikiPage[] }
    pages.value = data.pages ?? []
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Failed to load pages'
  } finally {
    loadingList.value = false
  }
}

async function selectPage(page: WikiPage) {
  if (selectedPage.value?.path === page.path) return
  selectedPage.value = page
  content.value = ''
  loadingContent.value = true
  contentError.value = ''
  try {
    const res = await apiFetch(`/api/wiki/${encodeURIComponent(page.path)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as WikiPageContent
    content.value = data.content ?? ''
  } catch (e) {
    contentError.value = e instanceof Error ? e.message : 'Failed to load page'
  } finally {
    loadingContent.value = false
  }
}

onMounted(fetchPages)
</script>
