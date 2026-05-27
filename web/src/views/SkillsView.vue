<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Puzzle, Plus, Trash2, Pencil, Save, X, Search, Globe } from "lucide-vue-next";
import MarkdownContent from "@/components/MarkdownContent.vue";

interface Skill {
  name: string;
  slug: string;
  description: string;
  path: string;
}

interface DiscoveredSkill {
  slug: string;
  name: string;
  description: string;
  source: "awesome-copilot" | "skillssh";
}

const DEFAULT_SKILL_TEMPLATE =
  "# My Skill\n\nA brief description of what this skill does.\n\n## Usage\n\nInstructions for how to use this skill...\n";

// ---- Installed skills state ----
const skills = ref<Skill[]>([]);
const loading = ref(true);
const showAddForm = ref(false);
const addMode = ref<"git" | "create">("git");
const newSkillUrl = ref("");
const newSkillTitle = ref("");
const newSkillContent = ref(DEFAULT_SKILL_TEMPLATE);
const adding = ref(false);
const error = ref("");

// Derives a display slug from the title using the same normalisation rules as
// createSkill() in src/copilot/skills.ts so the user sees the exact slug that
// will be used before submitting the form.
const newSkillSlug = computed(() =>
  newSkillTitle.value
    .trim()
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
);

// View/Edit state
const selectedSkill = ref<Skill | null>(null);
const skillContent = ref("");
const editMode = ref(false);
const editContent = ref("");
const loadingContent = ref(false);

// ---- Discovery state ----
type Tab = "installed" | "discover";
const activeTab = ref<Tab>("installed");
const discoverSource = ref<"awesome-copilot" | "skillssh">("awesome-copilot");
const discoverQuery = ref("");
const discoveredSkills = ref<DiscoveredSkill[]>([]);
const discoverLoading = ref(false);
const discoverError = ref("");
const selectedDiscovered = ref<DiscoveredSkill | null>(null);
const previewContent = ref("");
const previewLoading = ref(false);
const installingSlug = ref("");

async function fetchSkills() {
  loading.value = true;
  try {
    skills.value = await apiGet("/skills");
  } finally {
    loading.value = false;
  }
}

function openAddForm(mode: "git" | "create") {
  addMode.value = mode;
  showAddForm.value = true;
  error.value = "";
}

function cancelAddForm() {
  showAddForm.value = false;
  newSkillUrl.value = "";
  newSkillTitle.value = "";
  newSkillContent.value = DEFAULT_SKILL_TEMPLATE;
  error.value = "";
}

async function addSkillFromGit() {
  if (!newSkillUrl.value.trim()) return;
  adding.value = true;
  error.value = "";
  try {
    await apiPost("/skills", { url: newSkillUrl.value.trim() });
    cancelAddForm();
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to install skill";
  } finally {
    adding.value = false;
  }
}

async function createSkill() {
  if (!newSkillTitle.value.trim() || !newSkillContent.value.trim()) return;
  adding.value = true;
  error.value = "";
  try {
    await apiPost("/skills", {
      slug: newSkillSlug.value,
      content: newSkillContent.value,
    });
    cancelAddForm();
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to create skill";
  } finally {
    adding.value = false;
  }
}

async function removeSkill(slug: string) {
  try {
    await apiDelete(`/skills/${slug}`);
    if (selectedSkill.value?.slug === slug) {
      selectedSkill.value = null;
      skillContent.value = "";
    }
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to remove skill";
  }
}

async function viewSkill(skill: Skill) {
  selectedSkill.value = skill;
  editMode.value = false;
  loadingContent.value = true;
  try {
    const data = await apiGet(`/skills/${skill.slug}/content`);
    skillContent.value = data.content;
  } catch (err: any) {
    skillContent.value = `Error loading skill: ${err.message}`;
  } finally {
    loadingContent.value = false;
  }
}

function startEdit() {
  editContent.value = skillContent.value;
  editMode.value = true;
}

async function saveSkill() {
  if (!selectedSkill.value) return;
  try {
    await apiPut(`/skills/${selectedSkill.value.slug}/content`, { content: editContent.value });
    skillContent.value = editContent.value;
    editMode.value = false;
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to save skill";
  }
}

// ---- Discovery functions ----

async function loadDiscovery() {
  discoverLoading.value = true;
  discoverError.value = "";
  selectedDiscovered.value = null;
  previewContent.value = "";
  try {
    const params = new URLSearchParams({ source: discoverSource.value });
    if (discoverQuery.value.trim()) params.set("q", discoverQuery.value.trim());
    discoveredSkills.value = await apiGet(`/skills/discover?${params}`);
  } catch (err: any) {
    discoverError.value = err.message || "Failed to fetch community skills";
    discoveredSkills.value = [];
  } finally {
    discoverLoading.value = false;
  }
}

async function previewDiscovered(skill: DiscoveredSkill) {
  selectedDiscovered.value = skill;
  previewLoading.value = true;
  previewContent.value = "";
  try {
    const data = await apiGet(`/skills/preview?source=${skill.source}&slug=${encodeURIComponent(skill.slug)}`);
    previewContent.value = data.content;
  } catch (err: any) {
    previewContent.value = `Error loading preview: ${err.message}`;
  } finally {
    previewLoading.value = false;
  }
}

async function installDiscovered(skill: DiscoveredSkill) {
  installingSlug.value = skill.slug;
  error.value = "";
  try {
    await apiPost("/skills", { source: skill.source, slug: skill.slug });
    await fetchSkills();
    activeTab.value = "installed";
  } catch (err: any) {
    error.value = err.message || "Failed to install skill";
  } finally {
    installingSlug.value = "";
  }
}

function isInstalled(slug: string): boolean {
  return skills.value.some((s) => s.slug === slug);
}

function switchTab(tab: Tab) {
  activeTab.value = tab;
  selectedSkill.value = null;
  selectedDiscovered.value = null;
  skillContent.value = "";
  previewContent.value = "";
  if (tab === "discover" && discoveredSkills.value.length === 0) {
    loadDiscovery();
  }
}

onMounted(fetchSkills);
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar -->
    <div class="w-72 border-r border-border flex flex-col shrink-0">
      <!-- Tab switcher -->
      <div class="flex border-b border-border">
        <button
          @click="switchTab('installed')"
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors"
          :class="activeTab === 'installed' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'"
        >
          Installed
        </button>
        <button
          @click="switchTab('discover')"
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors"
          :class="activeTab === 'discover' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'"
        >
          <Globe class="w-3 h-3 inline mr-1" />
          Discover
        </button>
      </div>

      <!-- Installed tab content -->
      <template v-if="activeTab === 'installed'">
        <div class="p-3 border-b border-border space-y-2">
          <div class="flex gap-1">
            <button
              @click="openAddForm('git')"
              class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus class="w-3.5 h-3.5" />
              From Git
            </button>
            <button
              @click="openAddForm('create')"
              class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent"
            >
              <Plus class="w-3.5 h-3.5" />
              Create New
            </button>
          </div>

          <!-- Git clone form -->
          <div v-if="showAddForm && addMode === 'git'" class="space-y-1.5">
            <input
              v-model="newSkillUrl"
              type="text"
              placeholder="https://github.com/user/skill-repo.git"
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              @keyup.enter="addSkillFromGit"
            />
            <div class="flex gap-1">
              <button
                @click="addSkillFromGit"
                :disabled="adding || !newSkillUrl.trim()"
                class="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {{ adding ? "Installing..." : "Install" }}
              </button>
              <button
                @click="cancelAddForm"
                class="px-2 py-1 text-xs rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Create new skill form -->
          <div v-if="showAddForm && addMode === 'create'" class="space-y-1.5">
            <div>
              <input
                v-model="newSkillTitle"
                type="text"
                placeholder="Skill title"
                class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p v-if="newSkillTitle.trim()" class="mt-0.5 text-xs text-muted-foreground font-mono">
                slug: {{ newSkillSlug }}
              </p>
            </div>
            <textarea
              v-model="newSkillContent"
              rows="8"
              placeholder="# My Skill&#10;&#10;Describe your skill in Markdown..."
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            ></textarea>
            <div class="flex gap-1">
              <button
                @click="createSkill"
                :disabled="adding || !newSkillTitle.trim() || !newSkillContent.trim()"
                class="flex-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {{ adding ? "Creating..." : "Create" }}
              </button>
              <button
                @click="cancelAddForm"
                class="px-2 py-1 text-xs rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loading" class="text-xs text-muted-foreground p-2">Loading...</div>
          <div v-else-if="skills.length === 0" class="text-center py-8 text-muted-foreground">
            <Puzzle class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-xs">No skills installed.</p>
          </div>
          <div
            v-for="skill in skills"
            :key="skill.slug"
            @click="viewSkill(skill)"
            class="flex items-center justify-between px-2 py-2 text-xs rounded cursor-pointer hover:bg-accent transition-colors group"
            :class="{ 'bg-accent font-medium': selectedSkill?.slug === skill.slug }"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ skill.name }}</div>
              <div class="text-muted-foreground truncate">{{ skill.slug }}</div>
            </div>
            <button
              @click.stop="removeSkill(skill.slug)"
              class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity shrink-0"
              title="Remove"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </template>

      <!-- Discover tab content -->
      <template v-else>
        <div class="p-3 border-b border-border space-y-2">
          <!-- Source selector -->
          <select
            v-model="discoverSource"
            @change="loadDiscovery"
            class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="awesome-copilot">awesome-copilot</option>
            <option value="skillssh">skills.sh</option>
          </select>
          <!-- Search -->
          <div class="relative">
            <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              v-model="discoverQuery"
              type="text"
              placeholder="Search skills..."
              class="w-full rounded-md border border-input bg-background pl-6 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              @keyup.enter="loadDiscovery"
            />
          </div>
          <button
            @click="loadDiscovery"
            :disabled="discoverLoading"
            class="w-full px-2 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            {{ discoverLoading ? "Searching..." : "Search" }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="discoverLoading" class="text-xs text-muted-foreground p-2">Loading...</div>
          <div v-else-if="discoverError" class="text-xs text-destructive p-2">{{ discoverError }}</div>
          <div v-else-if="discoveredSkills.length === 0" class="text-center py-8 text-muted-foreground">
            <Globe class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-xs">No skills found.</p>
          </div>
          <div
            v-for="skill in discoveredSkills"
            :key="skill.slug"
            @click="previewDiscovered(skill)"
            class="flex items-start justify-between px-2 py-2 text-xs rounded cursor-pointer hover:bg-accent transition-colors gap-1"
            :class="{ 'bg-accent': selectedDiscovered?.slug === skill.slug }"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ skill.slug }}</div>
              <div class="text-muted-foreground line-clamp-2 mt-0.5" :title="skill.description">{{ skill.description }}</div>
            </div>
            <button
              v-if="!isInstalled(skill.slug)"
              @click.stop="installDiscovered(skill)"
              :disabled="installingSlug === skill.slug"
              class="shrink-0 mt-0.5 px-1.5 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              title="Install"
            >
              {{ installingSlug === skill.slug ? "..." : "Install" }}
            </button>
            <span v-else class="shrink-0 mt-0.5 px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
              Installed
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Content panel -->
    <div class="flex-1 flex flex-col">
      <!-- Installed skill viewer -->
      <template v-if="activeTab === 'installed'">
        <div v-if="!selectedSkill" class="flex items-center justify-center h-full text-muted-foreground">
          <div class="text-center">
            <Puzzle class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a skill to view</p>
          </div>
        </div>

        <template v-else>
          <div class="flex items-center justify-between px-4 py-2 border-b border-border">
            <div>
              <span class="text-sm font-medium">{{ selectedSkill.name }}</span>
              <span class="text-xs text-muted-foreground ml-2 font-mono">{{ selectedSkill.slug }}/SKILL.md</span>
            </div>
            <div class="flex gap-1">
              <template v-if="!editMode">
                <button @click="startEdit" class="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Edit">
                  <Pencil class="w-4 h-4" />
                </button>
              </template>
              <template v-else>
                <button @click="saveSkill" class="p-1.5 rounded hover:bg-accent text-green-500" title="Save">
                  <Save class="w-4 h-4" />
                </button>
                <button @click="editMode = false" class="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Cancel">
                  <X class="w-4 h-4" />
                </button>
              </template>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="loadingContent" class="text-muted-foreground text-sm">Loading...</div>
            <textarea
              v-else-if="editMode"
              v-model="editContent"
              class="w-full h-full min-h-[400px] font-mono text-sm bg-background border border-input rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            ></textarea>
            <MarkdownContent v-else :content="skillContent" />
          </div>
        </template>
      </template>

      <!-- Discovery preview -->
      <template v-else>
        <div v-if="!selectedDiscovered" class="flex items-center justify-center h-full text-muted-foreground">
          <div class="text-center">
            <Globe class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a skill to preview</p>
          </div>
        </div>

        <template v-else>
          <div class="flex items-center justify-between px-4 py-2 border-b border-border">
            <div class="min-w-0 flex-1">
              <span class="text-sm font-medium">{{ selectedDiscovered.slug }}</span>
              <span class="text-xs text-muted-foreground ml-2">{{ selectedDiscovered.source }}</span>
            </div>
            <button
              v-if="!isInstalled(selectedDiscovered.slug)"
              @click="installDiscovered(selectedDiscovered)"
              :disabled="installingSlug === selectedDiscovered.slug"
              class="ml-2 shrink-0 px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {{ installingSlug === selectedDiscovered.slug ? "Installing..." : "Install" }}
            </button>
            <span v-else class="ml-2 shrink-0 px-3 py-1 text-xs rounded bg-muted text-muted-foreground">
              Installed
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="previewLoading" class="text-muted-foreground text-sm">Loading preview...</div>
            <MarkdownContent v-else :content="previewContent" />
          </div>
        </template>
      </template>
    </div>

    <p v-if="error" class="absolute bottom-4 left-4 text-sm text-destructive bg-background border border-destructive/30 px-3 py-2 rounded-md">{{ error }}</p>
  </div>
</template>

