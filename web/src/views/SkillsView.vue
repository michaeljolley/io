<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { Puzzle, Plus, Trash2 } from "lucide-vue-next";

interface Skill {
  name: string;
  slug: string;
  description: string;
  path: string;
}

const skills = ref<Skill[]>([]);
const loading = ref(true);
const showAddForm = ref(false);
const newSkillUrl = ref("");
const adding = ref(false);
const error = ref("");

async function fetchSkills() {
  loading.value = true;
  try {
    skills.value = await apiGet("/skills");
  } finally {
    loading.value = false;
  }
}

async function addSkill() {
  if (!newSkillUrl.value.trim()) return;
  adding.value = true;
  error.value = "";
  try {
    await apiPost("/skills", { url: newSkillUrl.value.trim() });
    newSkillUrl.value = "";
    showAddForm.value = false;
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to install skill";
  } finally {
    adding.value = false;
  }
}

async function removeSkill(slug: string) {
  try {
    await apiDelete(`/skills/${slug}`);
    await fetchSkills();
  } catch (err: any) {
    error.value = err.message || "Failed to remove skill";
  }
}

onMounted(fetchSkills);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Skills</h1>
      <button
        @click="showAddForm = !showAddForm"
        class="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
      >
        <Plus class="w-4 h-4" />
        Add Skill
      </button>
    </div>

    <div v-if="showAddForm" class="mb-6 p-4 border border-border rounded-lg">
      <label class="block text-sm font-medium mb-2">Git Repository URL</label>
      <div class="flex gap-2">
        <input
          v-model="newSkillUrl"
          type="text"
          placeholder="https://github.com/user/skill-repo.git"
          class="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
          @keyup.enter="addSkill"
        />
        <button
          @click="addSkill"
          :disabled="adding || !newSkillUrl.trim()"
          class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {{ adding ? "Installing..." : "Install" }}
        </button>
      </div>
      <p v-if="error" class="text-sm text-destructive mt-2">{{ error }}</p>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="skills.length === 0" class="text-center py-12 text-muted-foreground">
      <Puzzle class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No skills installed.</p>
      <p class="text-sm mt-1">Click "Add Skill" to install from a git repository.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="skill in skills" :key="skill.slug" class="border border-border rounded-lg p-4 group">
        <div class="flex items-start justify-between">
          <h3 class="font-semibold">{{ skill.name }}</h3>
          <button
            @click="removeSkill(skill.slug)"
            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity"
            title="Remove skill"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        <p class="text-sm text-muted-foreground mt-1">{{ skill.description }}</p>
        <div class="text-xs text-muted-foreground mt-2 font-mono">{{ skill.slug }}</div>
      </div>
    </div>
  </div>
</template>
