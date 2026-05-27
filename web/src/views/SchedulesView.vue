<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet, apiPost, apiDelete, apiPut } from "@/lib/api";
import { Clock, Plus, Trash2 } from "lucide-vue-next";

interface Schedule {
  id: string;
  type: "squad" | "io";
  squad_id: string | null;
  cron: string;
  agenda: string;
  prompt: string;
  enabled: number;
  last_run: string | null;
}

interface Squad {
  id: string;
  name: string;
}

const schedules = ref<Schedule[]>([]);
const squads = ref<Squad[]>([]);
const loading = ref(true);
const tab = ref<"squad" | "io">("squad");
const showAdd = ref(false);
const newSchedule = ref({ type: "squad" as "squad" | "io", cron: "", squad_id: "", agenda: "triage", prompt: "" });

onMounted(async () => {
  try {
    const squadData = await apiGet("/squads");
    squads.value = squadData.squads;
    if (squads.value.length > 0) {
      newSchedule.value.squad_id = squads.value[0].id;
    }
    schedules.value = await apiGet("/schedules");
  } finally {
    loading.value = false;
  }
});

const filteredSchedules = () => schedules.value.filter((s) => s.type === tab.value);

async function addSchedule() {
  const body: any = {
    type: newSchedule.value.type,
    cron: newSchedule.value.cron,
    squad_id: newSchedule.value.squad_id,
  };
  if (newSchedule.value.type === "squad") {
    body.agenda = newSchedule.value.agenda;
  } else {
    body.prompt = newSchedule.value.prompt;
  }
  const schedule = await apiPost("/schedules", body);
  schedules.value.push(schedule);
  showAdd.value = false;
}

async function toggleSchedule(schedule: Schedule) {
  const enabled = !schedule.enabled;
  await apiPut(`/schedules/${schedule.id}`, { enabled });
  schedule.enabled = enabled ? 1 : 0;
}

async function deleteSchedule(id: string) {
  await apiDelete(`/schedules/${id}`);
  schedules.value = schedules.value.filter((s) => s.id !== id);
}

function getSquadName(squadId: string | null): string {
  if (!squadId) return "Unknown squad";
  return squads.value.find((s) => s.id === squadId)?.name ?? squadId;
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Schedules</h1>
      <button
        @click="showAdd = !showAdd"
        class="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus class="w-4 h-4" /> Add Schedule
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border mb-4">
      <button
        v-for="t in (['squad', 'io'] as const)"
        :key="t"
        @click="tab = t"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
      >
        {{ t === 'squad' ? 'Squad Schedules' : 'IO Schedules' }}
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showAdd" class="border border-border rounded-lg p-4 mb-4 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm font-medium">Type</label>
          <select v-model="newSchedule.type" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="squad">Squad</option>
            <option value="io">IO</option>
          </select>
        </div>
        <div>
          <label class="text-sm font-medium">Cron Expression</label>
          <input v-model="newSchedule.cron" placeholder="0 9 * * 1-5" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label class="text-sm font-medium">Target Squad</label>
        <select
          v-model="newSchedule.squad_id"
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option v-for="squad in squads" :key="squad.id" :value="squad.id">
            {{ squad.name }}
          </option>
        </select>
      </div>
      <div v-if="newSchedule.type === 'squad'">
        <label class="text-sm font-medium">Agenda</label>
        <select v-model="newSchedule.agenda" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="triage">Triage</option>
          <option value="prioritize">Prioritize</option>
          <option value="ideation">Ideation</option>
        </select>
      </div>
      <div v-else>
        <label class="text-sm font-medium">Prompt</label>
        <textarea v-model="newSchedule.prompt" rows="2" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"></textarea>
      </div>
      <button
        @click="addSchedule"
        :disabled="!newSchedule.squad_id"
        class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="filteredSchedules().length === 0" class="text-center py-12 text-muted-foreground">
      <Clock class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No {{ tab }} schedules configured.</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="schedule in filteredSchedules()" :key="schedule.id" class="flex items-center justify-between border border-border rounded-lg px-4 py-3">
        <div>
          <div class="text-sm font-medium font-mono">{{ schedule.cron }}</div>
          <div class="text-xs text-muted-foreground mt-0.5">
            {{ schedule.type === 'squad' ? `Agenda: ${schedule.agenda}` : schedule.prompt.slice(0, 60) }}
          </div>
          <div class="text-xs text-muted-foreground mt-0.5">
            Squad: {{ getSquadName(schedule.squad_id) }}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="toggleSchedule(schedule)"
            class="relative w-10 h-5 rounded-full transition-colors"
            :class="schedule.enabled ? 'bg-primary' : 'bg-muted'"
          >
            <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" :class="schedule.enabled ? 'translate-x-5' : 'translate-x-0.5'"></span>
          </button>
          <button @click="deleteSchedule(schedule.id)" class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
