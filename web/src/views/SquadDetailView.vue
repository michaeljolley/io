<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { apiGet } from "@/lib/api";
import { ArrowLeft, User, Shield, FlaskConical, Eye } from "lucide-vue-next";
import { getSquadLabelStyle } from "@/lib/squad-colors";
import AgentActivityPreview from "@/components/AgentActivityPreview.vue";

const route = useRoute();
const squad = ref<any>(null);
const agents = ref<any[]>([]);
const tasks = ref<any[]>([]);
const instances = ref<any[]>([]);
const loading = ref(true);
const previewTaskId = ref<string | null>(null);

function openPreview(taskId: string) {
  previewTaskId.value = taskId;
}

function closePreview() {
  previewTaskId.value = null;
}

function isActiveTask(status: string) {
  return status === "pending" || status === "in_progress";
}

onMounted(async () => {
  try {
    const data = await apiGet(`/squads/${route.params.id}`);
    squad.value = data.squad;
    agents.value = data.agents;
    tasks.value = data.tasks;
    instances.value = data.instances;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6">
    <router-link to="/squads" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
      <ArrowLeft class="w-4 h-4" /> Back to Squads
    </router-link>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <template v-else-if="squad">
      <div class="mb-6">
        <span class="inline-flex items-center text-sm px-2.5 py-1 rounded-full font-medium mb-2 w-fit" :style="getSquadLabelStyle(squad.color)">
          {{ squad.name }}
        </span>
        <p class="text-muted-foreground">{{ squad.universe }}</p>
      </div>

      <!-- Agents -->
      <section class="mb-8">
        <h2 class="text-lg font-semibold mb-3">Agent Roster</h2>
        <div class="border border-border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted">
              <tr>
                <th class="text-left px-4 py-2 font-medium">Character</th>
                <th class="text-left px-4 py-2 font-medium">Role</th>
                <th class="text-left px-4 py-2 font-medium">Status</th>
                <th class="text-left px-4 py-2 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in agents" :key="agent.id" class="border-t border-border">
                <td class="px-4 py-2 font-medium">{{ agent.character_name }}</td>
                <td class="px-4 py-2 text-muted-foreground">{{ agent.role_title }}</td>
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-green-500/10 text-green-500': agent.status === 'idle',
                      'bg-yellow-500/10 text-yellow-500': agent.status === 'working',
                      'bg-blue-500/10 text-blue-500': agent.status === 'reviewing',
                    }"
                  >
                    {{ agent.status }}
                  </span>
                </td>
                <td class="px-4 py-2 flex gap-1">
                  <span v-if="agent.is_lead" class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    <User class="w-3 h-3 inline" /> Lead
                  </span>
                  <span v-if="agent.is_qa" class="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                    <Shield class="w-3 h-3 inline" /> QA
                  </span>
                  <span v-if="agent.is_test" class="text-xs bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">
                    <FlaskConical class="w-3 h-3 inline" /> Test
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Instances -->
      <section v-if="instances.length > 0" class="mb-8">
        <h2 class="text-lg font-semibold mb-3">Active Instances</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div v-for="inst in instances" :key="inst.id" class="border border-border rounded-lg p-3">
            <div class="font-mono text-xs text-muted-foreground">{{ inst.id.slice(0, 8) }}</div>
            <div class="text-sm font-medium mt-1">{{ inst.branch }}</div>
            <div class="text-xs text-muted-foreground mt-1">Last activity: {{ inst.last_activity }}</div>
          </div>
        </div>
      </section>

      <!-- Recent Tasks -->
      <section>
        <h2 class="text-lg font-semibold mb-3">Recent Tasks</h2>
        <div v-if="tasks.length === 0" class="text-sm text-muted-foreground">No tasks yet.</div>
        <div v-else class="space-y-2">
          <div v-for="task in tasks" :key="task.id" class="border border-border rounded-lg p-3">
            <div class="flex items-center justify-between">
              <span class="text-sm">{{ task.description }}</span>
              <div class="flex items-center gap-2">
                <button
                  v-if="isActiveTask(task.status) || previewTaskId === task.id"
                  @click="previewTaskId === task.id ? closePreview() : openPreview(task.id)"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors"
                  :class="previewTaskId === task.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'"
                  :aria-label="previewTaskId === task.id ? 'Hide activity preview' : 'Show activity preview'"
                  :title="previewTaskId === task.id ? 'Hide preview' : 'Preview activity'"
                >
                  <Eye class="w-3 h-3" />
                  Preview
                </button>
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-yellow-500/10 text-yellow-500': task.status === 'pending',
                    'bg-blue-500/10 text-blue-500': task.status === 'in_progress',
                    'bg-green-500/10 text-green-500': task.status === 'done',
                    'bg-red-500/10 text-red-500': task.status === 'failed',
                  }"
                >
                  {{ task.status }}
                </span>
              </div>
            </div>

            <!-- Activity Preview Panel -->
            <div v-if="previewTaskId === task.id" class="mt-3 h-96">
              <AgentActivityPreview
                :task-id="task.id"
                :task-description="task.description"
                :task-status="task.status"
                @close="closePreview"
              />
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
