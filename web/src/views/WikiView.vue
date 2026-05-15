<template>
  <div class="flex flex-col md:flex-row h-full overflow-hidden bg-surface-0">
    <!-- ── Page list sidebar ── -->
    <div :class="["bg-surface-1/70 backdrop-blur-sm border-edge flex flex-col", selectedPage ? "hidden md:flex md:w-72 md:shrink-0 md:border-r" : "flex w-full md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r md:h-full max-h-64 md:max-h-none"]">
      <div class="p-3.5 shrink-0">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-txt-primary tracking-tight flex items-center gap-1.5">
            <span class="text-base">📚</span> Wiki
          </h2>
          <span class="text-[10px] text-txt-muted font-mono bg-surface-2/60 px-1.5 py-0.5 rounded">{{ filteredPages.length }}</span>
        </div>
        <input
          v-model="search"
          type="text"
          placeholder="Filter pages…"
          class="w-full px-3 py-1.5 text-sm bg-surface-2/50 border border-edge rounded-lg text-txt-primary
                 placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                 transition-all duration-200"
        />
      </div>

      <div class="mx-3 h-px bg-gradient-to-r from-transparent via-edge to-transparent"></div>

      <div v-if="loadingList" class="flex-1 flex items-center justify-center">
        <div class="flex items-center gap-2 text-txt-muted text-sm">
          <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
          Loading…
        </div>
      </div>
      <div v-else-if="listError" class="flex-1 p-4">
        <div class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{{ listError }}</div>
      </div>
      <ul v-else class="flex-1 overflow-y-auto py-2 px-2">
        <li v-if="filteredPages.length === 0" class="px-2 py-3 text-sm text-txt-muted text-center">
          No pages found
        </li>
        <li
          v-for="page in filteredPages"
          :key="page.path"
          @click="selectPage(page)"
          class="relative px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 mb-0.5"
          :class="selectedPage?.path === page.path
            ? 'bg-accent/10 text-accent'
            : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-3/40'"
        >
          <span
            v-if="selectedPage?.path === page.path"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent shadow-glow-sm"
          ></span>
          <span :class="selectedPage?.path === page.path ? 'ml-1' : ''">{{ page.title }}</span>
        </li>
      </ul>
    </div>

    <!-- ── Content area ── -->
    <div :class="["flex-1 min-w-0 flex flex-col overflow-hidden", !selectedPage ? "hidden md:flex" : "flex"]">
      <!-- Mobile: back to list button -->
      <div v-if="selectedPage" class="md:hidden flex items-center gap-2 px-3 py-2 border-b border-edge bg-surface-1/60 shrink-0">
        <button
          @click="selectedPage = null"
          class="flex items-center gap-1.5 text-xs text-txt-muted hover:text-accent transition-colors py-1"
        >
          <FluentIcon paths="<path d=\"M12.35 15.85a.5.5 0 0 1-.7 0L6.16 10.4a.55.55 0 0 1 0-.78l5.49-5.46a.5.5 0 1 1 .7.7L7.2 10l5.16 5.15c.2.2.2.5 0 .7Z\"/>" :size="14" />
          All pages
        </button>
        <span class="text-txt-muted/30">·</span>
        <span class="text-xs text-txt-primary font-medium truncate">{{ selectedPage.title }}</span>
      </div>
      <!-- Empty state -->
      <div v-if="!selectedPage" class="flex-1 flex flex-col items-center justify-center select-none">
        <div class="w-12 h-12 rounded-xl bg-surface-2/60 border border-edge flex items-center justify-center mb-4">
          <span class="text-2xl">📖</span>
        </div>
        <p class="text-txt-muted text-sm">Select a page to start reading</p>
      </div>

      <!-- Loading -->
      <div v-else-if="loadingContent" class="flex-1 flex items-center justify-center">
        <div class="flex items-center gap-2 text-txt-muted text-sm">
          <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
          Loading…
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="contentError" class="flex-1 p-6">
        <div class="inline-flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span>⚠</span> {{ contentError }}
        </div>
      </div>

      <!-- Content -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto px-6 py-6">
          <h1 class="text-xl font-bold text-txt-primary mb-4 pb-3 border-b border-edge">
            {{ selectedPage.title }}
          </h1>
          <div
            class="wiki-content text-txt-secondary text-sm leading-relaxed"
            v-html="renderedContent"
          />
        </div>
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

<style scoped>
.wiki-content :deep(h1),
.wiki-content :deep(h2),
.wiki-content :deep(h3),
.wiki-content :deep(h4) {
  line-height: 1.3;
}
.wiki-content :deep(pre) {
  font-family: 'JetBrains Mono', monospace;
  background: #060a13;
  border-color: #1e2d4a;
  border-radius: 0.625rem;
}
.wiki-content :deep(code) {
  font-family: 'JetBrains Mono', monospace;
}
.wiki-content :deep(a) {
  color: #22d3ee;
}
</style>
