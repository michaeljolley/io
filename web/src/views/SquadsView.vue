<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet } from "@/lib/api";
import { Users, GitBranch } from "lucide-vue-next";
import { getSquadLabelStyle } from "@/lib/squad-colors";

interface Squad {
  id: string;
  name: string;
  universe: string;
  color: string;
  repo_url: string | null;
  created_at: string;
}

interface Agent {
  id: string;
  squad_id: string;
  character_name: string;
  role_title: string;
  status: string;
  is_lead: number;
  is_qa: number;
  is_test: number;
}

const squads = ref<Squad[]>([]);
const agents = ref<Agent[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await apiGet("/squads");
    squads.value = data.squads;
    agents.value = data.agents;
  } finally {
    loading.value = false;
  }
});

function getAgentsForSquad(squadId: string) {
  return agents.value.filter((a) => a.squad_id === squadId);
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Squads</h1>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="squads.length === 0" class="text-center py-12 text-muted-foreground">
      <Users class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No squads yet.</p>
      <p class="text-sm mt-1">Ask IO to create a squad for your project.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="squad in squads"
        :key="squad.id"
        :to="`/squads/${squad.id}`"
        class="block rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors border-l-4"
        :style="{ borderLeftColor: squad.color }"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <span class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium" :style="getSquadLabelStyle(squad.color)">
              {{ squad.name }}
            </span>
            <p class="text-sm text-muted-foreground mt-0.5">{{ squad.universe }}</p>
          </div>
          <span class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
            {{ getAgentsForSquad(squad.id).length }} agents
          </span>
        </div>
        <div class="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span v-if="squad.repo_url" class="flex items-center gap-1">
            <GitBranch class="w-3 h-3" />
            {{ squad.repo_url }}
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>
