<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { apiGet } from "@/lib/api";
import { ClipboardList, Filter } from "lucide-vue-next";

interface AuditEntry {
  id: string;
  squad_id: string | null;
  agent_id: string | null;
  task_id: string | null;
  action_type: string;
  summary: string;
  payload: string;
  created_at: string;
}

interface Squad {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  squad_id: string;
  character_name: string;
  role_title: string;
}

const entries = ref<AuditEntry[]>([]);
const total = ref(0);
const loading = ref(true);
const expandedId = ref<string | null>(null);

const squads = ref<Squad[]>([]);
const agents = ref<Agent[]>([]);

// Filters
const filterSquad = ref("");
const filterAgent = ref("");
const filterActionType = ref("");
const filterFrom = ref("");
const filterTo = ref("");

const limit = 50;
const offset = ref(0);

const ACTION_TYPES = [
  "message_received",
  "task_delegated",
  "task_completed",
  "task_failed",
  "shell_command",
  "squad_created",
  "squad_meeting",
];

const ACTION_TYPE_COLORS: Record<string, string> = {
  message_received: "bg-blue-500/20 text-blue-400",
  task_delegated: "bg-purple-500/20 text-purple-400",
  task_completed: "bg-green-500/20 text-green-400",
  task_failed: "bg-red-500/20 text-red-400",
  shell_command: "bg-yellow-500/20 text-yellow-400",
  squad_created: "bg-indigo-500/20 text-indigo-400",
  squad_meeting: "bg-teal-500/20 text-teal-400",
};

function actionTypeClass(type: string): string {
  return ACTION_TYPE_COLORS[type] ?? "bg-secondary text-secondary-foreground";
}

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterSquad.value) params.set("squad_id", filterSquad.value);
    if (filterAgent.value) params.set("agent_id", filterAgent.value);
    if (filterActionType.value) params.set("action_type", filterActionType.value);
    if (filterFrom.value) params.set("from", filterFrom.value);
    if (filterTo.value) params.set("to", filterTo.value);
    params.set("limit", String(limit));
    params.set("offset", String(offset.value));
    const data = await apiGet(`/audit-log?${params.toString()}`);
    entries.value = data.entries;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function loadSquadsAndAgents() {
  const data = await apiGet("/squads");
  squads.value = data.squads;
  agents.value = data.agents;
}

function applyFilters() {
  offset.value = 0;
  loadData();
}

function resetFilters() {
  filterSquad.value = "";
  filterAgent.value = "";
  filterActionType.value = "";
  filterFrom.value = "";
  filterTo.value = "";
  offset.value = 0;
  loadData();
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit);
    loadData();
  }
}

function nextPage() {
  if (offset.value + limit < total.value) {
    offset.value = offset.value + limit;
    loadData();
  }
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function parsedPayload(entry: AuditEntry): string {
  try {
    return JSON.stringify(JSON.parse(entry.payload), null, 2);
  } catch {
    return entry.payload;
  }
}

function squadName(id: string | null): string {
  if (!id) return "";
  return squads.value.find((s) => s.id === id)?.name ?? id.slice(0, 8);
}

function agentName(id: string | null): string {
  if (!id) return "";
  const a = agents.value.find((a) => a.id === id);
  return a ? `${a.character_name} (${a.role_title})` : id.slice(0, 8);
}

const hasNextPage = computed(() => offset.value + limit < total.value);
const hasPrevPage = computed(() => offset.value > 0);
const currentPage = computed(() => Math.floor(offset.value / limit) + 1);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

const filteredAgents = computed(() => {
  if (!filterSquad.value) return agents.value;
  return agents.value.filter((a) => a.squad_id === filterSquad.value);
});

onMounted(async () => {
  await Promise.all([loadData(), loadSquadsAndAgents()]);
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <ClipboardList class="w-6 h-6" />
        Audit Log
      </h1>
      <span class="text-sm text-muted-foreground">{{ total }} entries</span>
    </div>

    <!-- Filters -->
    <div class="border border-border rounded-lg p-4 mb-6 space-y-3">
      <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
        <Filter class="w-4 h-4" />
        Filters
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <select
          v-model="filterSquad"
          class="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          @change="filterAgent = ''"
        >
          <option value="">All squads</option>
          <option v-for="s in squads" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <select
          v-model="filterAgent"
          class="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        >
          <option value="">All agents</option>
          <option v-for="a in filteredAgents" :key="a.id" :value="a.id">
            {{ a.character_name }}
          </option>
        </select>

        <select
          v-model="filterActionType"
          class="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        >
          <option value="">All action types</option>
          <option v-for="t in ACTION_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>

        <input
          v-model="filterFrom"
          type="datetime-local"
          placeholder="From"
          class="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        />

        <input
          v-model="filterTo"
          type="datetime-local"
          placeholder="To"
          class="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        />
      </div>
      <div class="flex gap-2">
        <button
          @click="applyFilters"
          class="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
        <button
          @click="resetFilters"
          class="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <!-- Empty state -->
    <div v-else-if="entries.length === 0" class="text-center py-12 text-muted-foreground">
      <ClipboardList class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No audit log entries found.</p>
    </div>

    <!-- Entries list -->
    <div v-else class="space-y-1">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="border border-border rounded-lg overflow-hidden"
      >
        <div
          @click="toggle(entry.id)"
          class="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-mono"
                :class="actionTypeClass(entry.action_type)"
              >
                {{ entry.action_type }}
              </span>
              <span
                v-if="entry.squad_id"
                class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
              >
                {{ squadName(entry.squad_id) }}
              </span>
              <span
                v-if="entry.agent_id"
                class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
              >
                {{ agentName(entry.agent_id) }}
              </span>
            </div>
            <p class="text-sm truncate">{{ entry.summary }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ entry.created_at }}</p>
          </div>
          <span class="text-xs text-muted-foreground mt-1 shrink-0">
            {{ expandedId === entry.id ? "▲" : "▼" }}
          </span>
        </div>

        <div v-if="expandedId === entry.id" class="border-t border-border px-4 py-3">
          <div v-if="entry.task_id" class="text-xs text-muted-foreground mb-2">
            Task ID: <code class="font-mono">{{ entry.task_id }}</code>
          </div>
          <pre class="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">{{ parsedPayload(entry) }}</pre>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="flex items-center justify-between mt-4">
      <button
        :disabled="!hasPrevPage"
        @click="prevPage"
        class="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground transition-colors"
      >
        ← Previous
      </button>
      <span class="text-xs text-muted-foreground">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button
        :disabled="!hasNextPage"
        @click="nextPage"
        class="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground transition-colors"
      >
        Next →
      </button>
    </div>
  </div>
</template>
