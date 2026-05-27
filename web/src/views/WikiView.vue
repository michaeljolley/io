<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { BookOpen, Search, Plus, Pencil, Trash2, Save, X } from "lucide-vue-next";

const pages = ref<string[]>([]);
const selectedPage = ref<string | null>(null);
const pageContent = ref("");
const editMode = ref(false);
const editContent = ref("");
const searchQuery = ref("");
const loading = ref(true);

onMounted(async () => {
  try {
    pages.value = await apiGet("/wiki/pages");
  } finally {
    loading.value = false;
  }
});

async function selectPage(path: string) {
  selectedPage.value = path;
  editMode.value = false;
  const data = await apiGet(`/wiki/page/${path}`);
  pageContent.value = data.content;
}

function startEdit() {
  editContent.value = pageContent.value;
  editMode.value = true;
}

async function savePage() {
  if (!selectedPage.value) return;
  await apiPut(`/wiki/page/${selectedPage.value}`, { content: editContent.value });
  pageContent.value = editContent.value;
  editMode.value = false;
}

async function deletePage() {
  if (!selectedPage.value) return;
  if (!confirm(`Delete "${selectedPage.value}"?`)) return;
  await apiDelete(`/wiki/page/${selectedPage.value}`);
  pages.value = pages.value.filter((p) => p !== selectedPage.value);
  selectedPage.value = null;
  pageContent.value = "";
}

const filteredPages = () => {
  if (!searchQuery.value) return pages.value;
  const q = searchQuery.value.toLowerCase();
  return pages.value.filter((p) => p.toLowerCase().includes(q));
};
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar file tree -->
    <div class="w-64 border-r border-border flex flex-col shrink-0">
      <div class="p-3 border-b border-border">
        <div class="relative">
          <Search class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input
            v-model="searchQuery"
            placeholder="Search pages..."
            class="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loading" class="text-xs text-muted-foreground p-2">Loading...</div>
        <button
          v-for="page in filteredPages()"
          :key="page"
          @click="selectPage(page)"
          class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent truncate transition-colors"
          :class="{ 'bg-accent font-medium': selectedPage === page }"
        >
          📄 {{ page }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col">
      <div v-if="!selectedPage" class="flex items-center justify-center h-full text-muted-foreground">
        <div class="text-center">
          <BookOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a page to view</p>
        </div>
      </div>

      <template v-else>
        <!-- Toolbar -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border">
          <span class="text-sm font-medium font-mono">{{ selectedPage }}</span>
          <div class="flex gap-1">
            <template v-if="!editMode">
              <button @click="startEdit" class="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Edit">
                <Pencil class="w-4 h-4" />
              </button>
              <button @click="deletePage" class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                <Trash2 class="w-4 h-4" />
              </button>
            </template>
            <template v-else>
              <button @click="savePage" class="p-1.5 rounded hover:bg-accent text-green-500" title="Save">
                <Save class="w-4 h-4" />
              </button>
              <button @click="editMode = false" class="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Cancel">
                <X class="w-4 h-4" />
              </button>
            </template>
          </div>
        </div>

        <!-- Content area -->
        <div class="flex-1 overflow-y-auto p-4">
          <textarea
            v-if="editMode"
            v-model="editContent"
            class="w-full h-full min-h-[400px] font-mono text-sm bg-background border border-input rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          ></textarea>
          <div v-else class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {{ pageContent }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
