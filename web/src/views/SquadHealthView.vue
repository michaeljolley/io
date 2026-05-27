<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { apiGet } from "@/lib/api";
import {
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  GitBranch,
  Users,
  Loader2,
} from "lucide-vue-next";

interface RecentTask {
  id: string;
  description: string;
  status: string;
  updatedAt: string;
}

interface ActiveInstance {
  id: string;
  branch: string;
  lastActivity: string;
}

interface SquadHealth {
  id: string;
  name: string;
  universe: string;
  agentCount: number;
  activeInstanceCount: number;
  activeInstances: ActiveInstance[];
  tasksTotal: number;
  tasksCompleted: number;
  tasksCompletedRecent: number;
  tasksPending: number;
  tasksInProgress: number;
  tasksFailed: number;
  avgCycleTimeMinutes: number | null;
  isStalled: boolean;
  recentTasks: RecentTask[];
}

const health = ref<SquadHealth[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await apiGet("/squads/health");
    health.value = data.health;
  } finally {
    loading.value = false;
  }
});

function formatCycleTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function squadStatus(squad: SquadHealth): "stalled" | "active" | "idle" {
  if (squad.isStalled) return "stalled";
  if (squad.tasksInProgress > 0) return "active";
  return "idle";
}

const sortedHealth = computed(() =>
  [...health.value].sort((a, b) => {
    const order = { stalled: 0, active: 1, idle: 2 };
    return order[squadStatus(a)] - order[squadStatus(b)];
  })
);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center gap-2 mb-6">
      <Activity class="w-6 h-6" />
      <h1 class="text-2xl font-bold">Squad Health</h1>
    </div>

    <div v-if="loading" class="flex items-center gap-2 text-muted-foreground">
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading...
    </div>

    <div v-else-if="health.length === 0" class="text-center py-12 text-muted-foreground">
      <Users class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No squads yet.</p>
      <p class="text-sm mt-1">Ask IO to create a squad for your project.</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="squad in sortedHealth"
        :key="squad.id"
        class="rounded-lg border bg-card p-4 flex flex-col gap-3"
        :class="{
          'border-red-500/50': squad.isStalled,
          'border-green-500/30': squadStatus(squad) === 'active',
          'border-border': squadStatus(squad) === 'idle',
        }"
      >
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div>
            <router-link
              :to="`/squads/${squad.id}`"
              class="font-semibold hover:underline"
            >
              {{ squad.name }}
            </router-link>
            <p class="text-xs text-muted-foreground mt-0.5">{{ squad.universe }}</p>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
            :class="{
              'bg-red-500/10 text-red-500': squad.isStalled,
              'bg-green-500/10 text-green-500': squadStatus(squad) === 'active',
              'bg-secondary text-secondary-foreground': squadStatus(squad) === 'idle',
            }"
          >
            <AlertTriangle v-if="squad.isStalled" class="w-3 h-3" />
            <span v-if="squad.isStalled">Stalled</span>
            <span v-else-if="squadStatus(squad) === 'active'">Active</span>
            <span v-else>Idle</span>
          </span>
        </div>

        <!-- Metrics row -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-md bg-muted px-2 py-2">
            <div class="text-lg font-bold">{{ squad.tasksCompleted }}</div>
            <div class="text-xs text-muted-foreground">Completed</div>
          </div>
          <div class="rounded-md bg-muted px-2 py-2">
            <div class="text-lg font-bold">{{ squad.tasksCompletedRecent }}</div>
            <div class="text-xs text-muted-foreground">Last 7d</div>
          </div>
          <div class="rounded-md bg-muted px-2 py-2">
            <div class="text-lg font-bold flex items-center justify-center gap-1">
              <Clock class="w-3 h-3 text-muted-foreground" />
              {{ formatCycleTime(squad.avgCycleTimeMinutes) }}
            </div>
            <div class="text-xs text-muted-foreground">Avg cycle</div>
          </div>
        </div>

        <!-- Task status badges -->
        <div class="flex flex-wrap gap-1.5 text-xs">
          <span
            v-if="squad.tasksInProgress > 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500"
          >
            {{ squad.tasksInProgress }} in progress
          </span>
          <span
            v-if="squad.tasksPending > 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500"
          >
            {{ squad.tasksPending }} pending
          </span>
          <span
            v-if="squad.tasksFailed > 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500"
          >
            {{ squad.tasksFailed }} failed
          </span>
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
          >
            <Users class="w-3 h-3" /> {{ squad.agentCount }} agents
          </span>
        </div>

        <!-- Active instances -->
        <div v-if="squad.activeInstanceCount > 0">
          <p class="text-xs font-medium text-muted-foreground mb-1">Active instances</p>
          <div class="space-y-1">
            <div
              v-for="inst in squad.activeInstances"
              :key="inst.id"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <GitBranch class="w-3 h-3 shrink-0" />
              <span class="font-mono truncate">{{ inst.branch }}</span>
            </div>
          </div>
        </div>

        <!-- Recent activity timeline -->
        <div v-if="squad.recentTasks.length > 0">
          <p class="text-xs font-medium text-muted-foreground mb-1">Recent activity</p>
          <div class="space-y-1">
            <div
              v-for="task in squad.recentTasks"
              :key="task.id"
              class="flex items-center gap-2 text-xs"
            >
              <CheckCircle
                v-if="task.status === 'done'"
                class="w-3 h-3 text-green-500 shrink-0"
              />
              <Loader2
                v-else-if="task.status === 'in_progress'"
                class="w-3 h-3 text-blue-500 shrink-0 animate-spin"
              />
              <AlertTriangle
                v-else-if="task.status === 'failed'"
                class="w-3 h-3 text-red-500 shrink-0"
              />
              <Clock
                v-else
                class="w-3 h-3 text-yellow-500 shrink-0"
              />
              <span class="truncate text-muted-foreground">{{ task.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
