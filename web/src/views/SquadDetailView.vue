<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { useRoute } from "vue-router";
  import { apiGet, apiDelete, apiPost } from "@/lib/api";
  import {
    ArrowLeft,
    User,
    Shield,
    FlaskConical,
    GitBranch,
    Trash2,
    Activity,
    Eye,
    Square,
  } from "lucide-vue-next";
  import { getSquadLabelStyle } from "@/lib/squad-colors";
  import AgentActivityPreview from "@/components/AgentActivityPreview.vue";

  const MAX_INSTANCES = 3;

  const route = useRoute();
  const squad = ref<any>(null);
  const agents = ref<any[]>([]);
  const tasks = ref<any[]>([]);
  const instances = ref<any[]>([]);
  const loading = ref(true);
  const destroyingId = ref<string | null>(null);
  const stoppingTaskId = ref<string | null>(null);
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

  async function stopTask(taskId: string) {
    if (stoppingTaskId.value) return;
    stoppingTaskId.value = taskId;
    try {
      await apiPost(`/tasks/${taskId}/stop`);
      const task = tasks.value.find((t) => t.id === taskId);
      if (task) {
        task.status = "stopped";
      }
    } catch (err) {
      console.error("Failed to stop task:", err);
    } finally {
      stoppingTaskId.value = null;
    }
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

  async function destroyInstance(instanceId: string, branch: string) {
    if (!confirm(`Destroy instance on branch "${branch}"? This will remove the worktree.`)) return;
    destroyingId.value = instanceId;
    try {
      await apiDelete(`/instances/${instanceId}`);
      instances.value = instances.value.filter((i) => i.id !== instanceId);
    } finally {
      destroyingId.value = null;
    }
  }

  function relativeTime(isoString: string): string {
    if (!isoString) return "never";
    // SQLite datetime() returns "YYYY-MM-DD HH:MM:SS" (no T, no Z)
    const normalized =
      isoString.replace(" ", "T") + (isoString.includes("T") || isoString.endsWith("Z") ? "" : "Z");
    const diff = Date.now() - new Date(normalized).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<template>
  <div class="p-6">
    <router-link
      to="/squads"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
    >
      <ArrowLeft class="w-4 h-4" /> Back to Squads
    </router-link>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <template v-else-if="squad">
      <div class="mb-6">
        <span
          class="inline-flex items-center text-sm px-2.5 py-1 rounded-full font-medium mb-2 w-fit"
          :style="getSquadLabelStyle(squad.color)"
        >
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
                  <span
                    v-if="agent.is_lead"
                    class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                  >
                    <User class="w-3 h-3 inline" /> Lead
                  </span>
                  <span
                    v-if="agent.is_qa"
                    class="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded"
                  >
                    <Shield class="w-3 h-3 inline" /> QA
                  </span>
                  <span
                    v-if="agent.is_test"
                    class="text-xs bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded"
                  >
                    <FlaskConical class="w-3 h-3 inline" /> Test
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Instances -->
      <section class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">Instances</h2>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            :class="
              instances.length >= MAX_INSTANCES
                ? 'bg-red-500/10 text-red-500'
                : 'bg-secondary text-secondary-foreground'
            "
          >
            {{ instances.length }} / {{ MAX_INSTANCES }} active
          </span>
        </div>
        <div
          v-if="instances.length === 0"
          class="text-sm text-muted-foreground border border-border rounded-lg p-4 text-center"
        >
          No active instances.
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            v-for="inst in instances"
            :key="inst.id"
            class="border border-border rounded-lg p-3 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <GitBranch class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span class="text-sm font-medium truncate">{{ inst.branch }}</span>
              </div>
              <span
                class="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                :class="{
                  'bg-green-500/10 text-green-500': inst.status === 'active',
                  'bg-red-500/10 text-red-500': inst.status === 'destroyed',
                  'bg-yellow-500/10 text-yellow-500': inst.status === 'stale',
                }"
                >{{ inst.status }}</span
              >
            </div>
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity class="w-3 h-3 shrink-0" />
              <span>{{ relativeTime(inst.last_activity) }}</span>
            </div>
            <div
              class="font-mono text-xs text-muted-foreground truncate"
              :title="inst.worktree_path"
            >
              {{ inst.worktree_path }}
            </div>
            <div class="pt-1 border-t border-border">
              <button
                class="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="destroyingId === inst.id"
                @click="destroyInstance(inst.id, inst.branch)"
              >
                <Trash2 class="w-3 h-3" />
                {{ destroyingId === inst.id ? "Destroying…" : "Destroy" }}
              </button>
            </div>
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
                  v-if="isActiveTask(task.status)"
                  @click="stopTask(task.id)"
                  :disabled="stoppingTaskId === task.id"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Stop agent"
                  title="Stop agent"
                >
                  <Square class="w-3 h-3" />
                  {{ stoppingTaskId === task.id ? "Stopping…" : "Stop" }}
                </button>
                <button
                  v-if="isActiveTask(task.status) || previewTaskId === task.id"
                  @click="previewTaskId === task.id ? closePreview() : openPreview(task.id)"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors"
                  :class="
                    previewTaskId === task.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                  "
                  :aria-label="
                    previewTaskId === task.id ? 'Hide activity preview' : 'Show activity preview'
                  "
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
                    'bg-orange-500/10 text-orange-500': task.status === 'stopped',
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
                @stopped="task.status = 'stopped'"
              />
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
