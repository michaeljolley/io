<script setup lang="ts">
  import { ref, onMounted, watch } from "vue";
  import { apiGet, apiPut, apiDelete } from "@/lib/api";
  import { BookOpen, Search, Plus, Pencil, Trash2, Save, X, Link, FileCode } from "lucide-vue-next";
  import MarkdownContent from "@/components/MarkdownContent.vue";
  import WikiTree from "@/components/WikiTree.vue";

  type Mode = "pages" | "templates";

  const mode = ref<Mode>("pages");

  // --- Pages ---
  const pages = ref<string[]>([]);
  const selectedPage = ref<string | null>(null);
  const pageContent = ref("");
  const editMode = ref(false);
  const editContent = ref("");
  const searchQuery = ref("");
  const loading = ref(true);
  const showNewForm = ref(false);
  const newPagePath = ref("");
  const backlinks = ref<string[]>([]);

  // --- Templates ---
  const templates = ref<string[]>([]);
  const selectedTemplate = ref<string | null>(null);
  const templateContent = ref("");
  const templateEditMode = ref(false);
  const templateEditContent = ref("");
  const templateLoading = ref(false);
  const showNewTemplateForm = ref(false);
  const newTemplatePath = ref("");

  onMounted(async () => {
    try {
      pages.value = await apiGet("/wiki/pages");
    } finally {
      loading.value = false;
    }
  });

  watch(mode, async (val) => {
    if (val === "templates" && templates.value.length === 0) {
      templateLoading.value = true;
      try {
        templates.value = await apiGet("/wiki/templates/squad");
      } finally {
        templateLoading.value = false;
      }
    }
  });

  async function selectPage(path: string) {
    selectedPage.value = path;
    editMode.value = false;
    const data = await apiGet(`/wiki/page/${path}`);
    pageContent.value = data.content;
    backlinks.value = await apiGet(`/wiki/backlinks/${path}`);
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
    backlinks.value = await apiGet(`/wiki/backlinks/${selectedPage.value}`);
  }

  async function deletePage() {
    if (!selectedPage.value) return;
    if (!confirm(`Delete "${selectedPage.value}"?`)) return;
    await apiDelete(`/wiki/page/${selectedPage.value}`);
    pages.value = pages.value.filter((p) => p !== selectedPage.value);
    selectedPage.value = null;
    pageContent.value = "";
    backlinks.value = [];
  }

  async function createPage() {
    const path = newPagePath.value.trim();
    if (!path) return;
    // Ensure .md extension
    const fullPath = path.endsWith(".md") ? path : `${path}.md`;
    await apiPut(`/wiki/page/${fullPath}`, { content: "" });
    if (!pages.value.includes(fullPath)) {
      pages.value.push(fullPath);
      pages.value.sort();
    }
    showNewForm.value = false;
    newPagePath.value = "";
    // Open the new page in edit mode
    selectedPage.value = fullPath;
    pageContent.value = "";
    editContent.value = "";
    editMode.value = true;
    backlinks.value = [];
  }

  // --- Template helpers ---
  async function selectTemplate(path: string) {
    selectedTemplate.value = path;
    templateEditMode.value = false;
    const data = await apiGet(`/wiki/template/squad/${path}`);
    templateContent.value = data.content;
  }

  function startTemplateEdit() {
    templateEditContent.value = templateContent.value;
    templateEditMode.value = true;
  }

  async function saveTemplate() {
    if (!selectedTemplate.value) return;
    await apiPut(`/wiki/template/squad/${selectedTemplate.value}`, {
      content: templateEditContent.value,
    });
    templateContent.value = templateEditContent.value;
    templateEditMode.value = false;
  }

  async function deleteTemplate() {
    if (!selectedTemplate.value) return;
    if (!confirm(`Delete template "${selectedTemplate.value}"?`)) return;
    await apiDelete(`/wiki/template/squad/${selectedTemplate.value}`);
    templates.value = templates.value.filter((t) => t !== selectedTemplate.value);
    selectedTemplate.value = null;
    templateContent.value = "";
  }

  async function createTemplate() {
    const path = newTemplatePath.value.trim();
    if (!path) return;
    const fullPath = path.endsWith(".md") ? path : `${path}.md`;
    await apiPut(`/wiki/template/squad/${fullPath}`, { content: "" });
    if (!templates.value.includes(fullPath)) {
      templates.value.push(fullPath);
      templates.value.sort();
    }
    showNewTemplateForm.value = false;
    newTemplatePath.value = "";
    selectedTemplate.value = fullPath;
    templateContent.value = "";
    templateEditContent.value = "";
    templateEditMode.value = true;
  }
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Mode tabs -->
    <div class="flex border-b border-border shrink-0">
      <button
        @click="mode = 'pages'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          mode === 'pages'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        ]"
      >
        <BookOpen class="inline w-4 h-4 mr-1.5 -mt-0.5" />
        Pages
      </button>
      <button
        @click="mode = 'templates'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          mode === 'templates'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        ]"
      >
        <FileCode class="inline w-4 h-4 mr-1.5 -mt-0.5" />
        Squad Templates
      </button>
    </div>

    <!-- Pages mode -->
    <div v-if="mode === 'pages'" class="flex flex-1 overflow-hidden">
      <!-- Sidebar file tree -->
      <div class="w-64 border-r border-border flex flex-col shrink-0">
        <div class="p-3 border-b border-border space-y-2">
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input
              v-model="searchQuery"
              placeholder="Search pages..."
              class="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            @click="showNewForm = !showNewForm"
            class="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus class="w-3.5 h-3.5" />
            New Page
          </button>
          <div v-if="showNewForm" class="space-y-1.5">
            <input
              v-model="newPagePath"
              placeholder="path/to/page.md"
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              @keyup.enter="createPage"
            />
            <div class="flex gap-1">
              <button
                @click="createPage"
                :disabled="!newPagePath.trim()"
                class="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Create
              </button>
              <button
                @click="
                  showNewForm = false;
                  newPagePath = '';
                "
                class="px-2 py-1 text-xs rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loading" class="text-xs text-muted-foreground p-2">Loading...</div>
          <WikiTree
            v-else
            :pages="pages"
            :selected-page="selectedPage"
            :search-query="searchQuery"
            @select="selectPage($event)"
            @add-file="
              showNewForm = true;
              newPagePath = $event + '/';
            "
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div
          v-if="!selectedPage"
          class="flex items-center justify-center h-full text-muted-foreground"
        >
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
                <button
                  @click="startEdit"
                  class="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  title="Edit"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  @click="deletePage"
                  class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </template>
              <template v-else>
                <button
                  @click="savePage"
                  class="p-1.5 rounded hover:bg-accent text-green-500"
                  title="Save"
                >
                  <Save class="w-4 h-4" />
                </button>
                <button
                  @click="editMode = false"
                  class="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  title="Cancel"
                >
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
            <template v-else>
              <MarkdownContent :content="pageContent" />
              <div v-if="backlinks.length > 0" class="mt-8 pt-4 border-t border-border">
                <div
                  class="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground"
                >
                  <Link class="w-3.5 h-3.5" />
                  Backlinks
                </div>
                <ul class="space-y-1">
                  <li v-for="link in backlinks" :key="link">
                    <button
                      @click="selectPage(link)"
                      class="text-xs text-primary hover:underline font-mono"
                    >
                      {{ link }}
                    </button>
                  </li>
                </ul>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Templates mode -->
    <div v-else class="flex flex-1 overflow-hidden">
      <!-- Sidebar template list -->
      <div class="w-64 border-r border-border flex flex-col shrink-0">
        <div class="p-3 border-b border-border space-y-2">
          <p class="text-xs text-muted-foreground">
            Files copied verbatim into each new squad's wiki directory on creation.
          </p>
          <button
            @click="showNewTemplateForm = !showNewTemplateForm"
            class="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus class="w-3.5 h-3.5" />
            New Template
          </button>
          <div v-if="showNewTemplateForm" class="space-y-1.5">
            <input
              v-model="newTemplatePath"
              placeholder="filename.md"
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              @keyup.enter="createTemplate"
            />
            <div class="flex gap-1">
              <button
                @click="createTemplate"
                :disabled="!newTemplatePath.trim()"
                class="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Create
              </button>
              <button
                @click="
                  showNewTemplateForm = false;
                  newTemplatePath = '';
                "
                class="px-2 py-1 text-xs rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="templateLoading" class="text-xs text-muted-foreground p-2">Loading...</div>
          <div v-else-if="templates.length === 0" class="text-xs text-muted-foreground p-2">
            No templates yet.
          </div>
          <button
            v-else
            v-for="t in templates"
            :key="t"
            @click="selectTemplate(t)"
            :class="[
              'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent font-mono truncate',
              selectedTemplate === t ? 'bg-accent text-accent-foreground' : 'text-foreground',
            ]"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <!-- Template content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div
          v-if="!selectedTemplate"
          class="flex items-center justify-center h-full text-muted-foreground"
        >
          <div class="text-center">
            <FileCode class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a template to edit</p>
            <p class="text-xs mt-1">Templates are copied into new squads on creation</p>
          </div>
        </div>

        <template v-else>
          <!-- Toolbar -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-border">
            <span class="text-sm font-medium font-mono">{{ selectedTemplate }}</span>
            <div class="flex gap-1">
              <template v-if="!templateEditMode">
                <button
                  @click="startTemplateEdit"
                  class="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  title="Edit"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  @click="deleteTemplate"
                  class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </template>
              <template v-else>
                <button
                  @click="saveTemplate"
                  class="p-1.5 rounded hover:bg-accent text-green-500"
                  title="Save"
                >
                  <Save class="w-4 h-4" />
                </button>
                <button
                  @click="templateEditMode = false"
                  class="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  title="Cancel"
                >
                  <X class="w-4 h-4" />
                </button>
              </template>
            </div>
          </div>

          <!-- Content area -->
          <div class="flex-1 overflow-y-auto p-4">
            <textarea
              v-if="templateEditMode"
              v-model="templateEditContent"
              class="w-full h-full min-h-[400px] font-mono text-sm bg-background border border-input rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            ></textarea>
            <MarkdownContent v-else :content="templateContent" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
