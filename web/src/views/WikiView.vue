<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import WikiTreeNode from '@/components/WikiTreeNode.vue'
import WikiEditModal from '@/components/WikiEditModal.vue'
import WikiDeleteConfirmation from '@/components/WikiDeleteConfirmation.vue'
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
const treeOpen = ref(false)

const editModalOpen = ref(false)
const deleteConfirmOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')

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
  if (!response.ok) {
    detail.value = null
    return
  }
  detail.value = await response.json() as WikiDetail
}

function selectPage(path: string) {
  selectedPath.value = path
  treeOpen.value = false
  error.value = ''
}

async function handleSave(data: { content: string, category: string }) {
  saving.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/wiki/${encodeURIComponent(selectedPath.value)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.content,
        category: data.category || null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 404) {
        error.value = 'Page not found'
      } else if (response.status === 403) {
        error.value = 'You do not have permission to edit this page'
      } else {
        error.value = errorText || 'Failed to save page'
      }
      return
    }

    // Reload the page content
    await loadDetail(selectedPath.value)
    editModalOpen.value = false
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/wiki/${encodeURIComponent(selectedPath.value)}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 404) {
        error.value = 'Page not found'
      } else if (response.status === 403) {
        error.value = 'You do not have permission to delete this page'
      } else {
        error.value = errorText || 'Failed to delete page'
      }
      return
    }

    // Reload pages and clear selection
    await loadPages()
    selectedPath.value = pages.value[0]?.path ?? ''
    detail.value = null
    deleteConfirmOpen.value = false
  } finally {
    deleting.value = false
  }
}

watch(selectedPath, (path) => {
  loadDetail(path)
})

onMounted(loadPages)
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden md:flex-row">
    <!-- Mobile tree toggle -->
    <div class="flex shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4 py-2 md:hidden">
      <button
        class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        @click="treeOpen = !treeOpen"
      >
        <AppIcon name="book" class="h-3.5 w-3.5" />
        <span>{{ detail?.path ?? 'Pages' }}</span>
        <AppIcon name="chevron-down" class="h-3 w-3 transition-transform" :class="treeOpen ? 'rotate-180' : ''" />
      </button>
    </div>

    <!-- Mobile tree drawer -->
    <transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div v-if="treeOpen" class="absolute left-0 right-0 top-[calc(2.75rem+2.75rem)] z-20 max-h-[60vh] overflow-y-auto border-b border-border bg-sidebar px-2 py-3 md:hidden">
        <input v-model="query" class="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35" placeholder="Filter pages" />
        <WikiTreeNode v-for="node in tree" :key="node.id" :node="node" :selected-path="selectedPath" @select="selectPage($event)" />
      </div>
    </transition>

    <!-- Desktop sidebar -->
    <aside class="hidden w-52 shrink-0 overflow-y-auto border-r border-border px-2 py-4 md:block">
      <input v-model="query" class="mb-3 w-full rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/35" placeholder="Filter pages" />
      <WikiTreeNode v-for="node in tree" :key="node.id" :node="node" :selected-path="selectedPath" @select="selectedPath = $event" />
    </aside>

    <!-- Content -->
    <section class="flex-1 flex flex-col overflow-hidden">
      <!-- Action buttons -->
      <div v-if="detail" class="flex shrink-0 items-center justify-between border-b border-border bg-sidebar px-4 py-3">
        <div class="flex items-center gap-2">
          <AppIcon name="book" class="h-4 w-4 text-muted-foreground/50" />
          <span class="font-mono text-xs text-muted-foreground/70 truncate">{{ detail.path }}</span>
        </div>
        <div class="flex gap-2">
          <button
            class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-mono text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            @click="editModalOpen = true"
          >
            <AppIcon name="pencil" class="h-3 w-3" />
            Edit
          </button>
          <button
            class="flex items-center gap-1.5 rounded border border-destructive/40 px-3 py-1.5 text-xs font-mono text-destructive transition-colors hover:bg-destructive/10"
            @click="deleteConfirmOpen = true"
          >
            <AppIcon name="trash" class="h-3 w-3" />
            Delete
          </button>
        </div>
      </div>

      <!-- Error display -->
      <div v-if="error" class="flex shrink-0 items-center gap-2 border-b border-destructive/50 bg-destructive/10 px-4 py-2">
        <AppIcon name="alert-circle" class="h-4 w-4 text-destructive" />
        <span class="flex-1 text-xs text-destructive">{{ error }}</span>
        <button class="text-destructive/50 hover:text-destructive" @click="error = ''">
          <AppIcon name="x" class="h-3 w-3" />
        </button>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="detail" class="max-w-2xl px-4 py-5 md:px-8 md:py-6">
          <h2 class="mb-5 text-xl font-semibold">{{ detail.path }}</h2>
          <div class="wiki-content" v-html="renderMarkdown(detail.content)" />
        </div>
        <div v-else class="flex h-full items-center justify-center font-mono text-sm text-muted-foreground/40">Select an article</div>
      </div>
    </section>

    <!-- Modals -->
    <WikiEditModal
      :open="editModalOpen"
      :path="selectedPath"
      :content="detail?.content ?? ''"
      @close="editModalOpen = false"
      @save="handleSave"
    />
    <WikiDeleteConfirmation
      :open="deleteConfirmOpen"
      :path="selectedPath"
      @close="deleteConfirmOpen = false"
      @confirm="handleDelete"
    />
  </div>
</template>
