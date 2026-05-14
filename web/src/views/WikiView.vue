<template>
  <div class="flex h-full overflow-hidden">
    <!-- Left panel: page list -->
    <div class="w-72 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div class="p-4 border-b border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-300">📚 Wiki</h2>
          <span class="text-xs text-gray-500">{{ filteredPages.length }} pages</span>
        </div>
        <input
          v-model="search"
          type="text"
          placeholder="Filter pages…"
          class="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div v-if="loadingList" class="flex-1 flex items-center justify-center">
        <span class="text-sm text-gray-500">Loading…</span>
      </div>
      <div v-else-if="listError" class="flex-1 p-4">
        <p class="text-sm text-red-400">{{ listError }}</p>
      </div>
      <ul v-else class="flex-1 overflow-y-auto py-2">
        <li v-if="filteredPages.length === 0" class="px-4 py-3 text-sm text-gray-500">
          No pages found.
        </li>
        <li
          v-for="page in filteredPages"
          :key="page.path"
          @click="selectPage(page)"
          class="px-4 py-2 cursor-pointer text-sm transition-colors hover:bg-gray-800"
          :class="selectedPage?.path === page.path
            ? 'bg-blue-900 text-blue-300 font-medium'
            : 'text-gray-300'"
        >
          {{ page.title }}
        </li>
      </ul>
    </div>

    <!-- Right panel: page content -->
    <div class="flex-1 min-w-0 flex flex-col bg-gray-950 overflow-hidden">
      <!-- No selection -->
      <div v-if="!selectedPage" class="flex-1 flex items-center justify-center">
        <p class="text-gray-600 text-sm">Select a page to view</p>
      </div>

      <!-- Loading content -->
      <div v-else-if="loadingContent" class="flex-1 flex items-center justify-center">
        <span class="text-sm text-gray-500">Loading…</span>
      </div>

      <!-- Error -->
      <div v-else-if="contentError" class="flex-1 p-6">
        <p class="text-sm text-red-400">{{ contentError }}</p>
      </div>

      <!-- Content -->
      <div v-else class="flex-1 overflow-y-auto p-6">
        <h1 class="text-xl font-bold text-gray-100 mb-4 pb-3 border-b border-gray-800">
          {{ selectedPage.title }}
        </h1>
        <div
          class="wiki-content text-gray-300 text-sm leading-relaxed"
          v-html="renderedContent"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

/** Lightweight markdown → HTML renderer (no external dep). */
function renderMarkdown(md: string): string {
  if (!md) return ''

  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let inList = false
  let codeLines: string[] = []
  let codeLang = ''

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  function inlineFormat(text: string): string {
    return text
      // Escape < and > first so we don't double-encode our own tags
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // bold + italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-blue-300 font-mono text-xs">$1</code>')
      // links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-400 hover:underline">$1</a>')
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList()
        inCode = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        const escaped = codeLines.join('\n')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        out.push(`<pre class="bg-gray-900 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
        inCode = false
        codeLines = []
        codeLang = ''
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    // Headings
    const h4 = line.match(/^####\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h4) { closeList(); out.push(`<h4 class="text-sm font-semibold text-gray-200 mt-4 mb-1">${inlineFormat(h4[1])}</h4>`); continue }
    if (h3) { closeList(); out.push(`<h3 class="text-base font-semibold text-gray-100 mt-5 mb-2">${inlineFormat(h3[1])}</h3>`); continue }
    if (h2) { closeList(); out.push(`<h2 class="text-lg font-bold text-gray-100 mt-6 mb-2 pb-1 border-b border-gray-800">${inlineFormat(h2[1])}</h2>`); continue }
    if (h1) { closeList(); out.push(`<h1 class="text-xl font-bold text-gray-100 mt-6 mb-3">${inlineFormat(h1[1])}</h1>`); continue }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr class="border-gray-800 my-4" />'); continue }

    // Unordered list items
    const li = line.match(/^[-*+]\s+(.+)/)
    if (li) {
      if (!inList) { out.push('<ul class="list-disc list-inside my-2 space-y-1 pl-2">'); inList = true }
      out.push(`<li>${inlineFormat(li[1])}</li>`)
      continue
    }

    // Ordered list items
    const oli = line.match(/^\d+\.\s+(.+)/)
    if (oli) {
      if (!inList) { out.push('<ol class="list-decimal list-inside my-2 space-y-1 pl-2">'); inList = true }
      out.push(`<li>${inlineFormat(oli[1])}</li>`)
      continue
    }

    // Blank line
    if (line.trim() === '') {
      closeList()
      out.push('<div class="my-2"></div>')
      continue
    }

    closeList()
    out.push(`<p class="my-1">${inlineFormat(line)}</p>`)
  }

  // Close any unclosed code block
  if (inCode && codeLines.length) {
    const escaped = codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(`<pre class="bg-gray-900 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
  }
  closeList()

  return out.join('\n')
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
</style>
