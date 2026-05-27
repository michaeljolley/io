<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet } from "@/lib/api";
import { Puzzle } from "lucide-vue-next";

interface Skill {
  name: string;
  slug: string;
  description: string;
  path: string;
}

const skills = ref<Skill[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    skills.value = await apiGet("/skills");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Skills</h1>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="skills.length === 0" class="text-center py-12 text-muted-foreground">
      <Puzzle class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No skills installed.</p>
      <p class="text-sm mt-1">Use <code>io skill add &lt;url&gt;</code> to install skills.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="skill in skills" :key="skill.slug" class="border border-border rounded-lg p-4">
        <h3 class="font-semibold">{{ skill.name }}</h3>
        <p class="text-sm text-muted-foreground mt-1">{{ skill.description }}</p>
        <div class="text-xs text-muted-foreground mt-2 font-mono">{{ skill.slug }}</div>
      </div>
    </div>
  </div>
</template>
