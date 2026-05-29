<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted, computed, nextTick } from "vue";
  import { apiGet, apiPost, createEventSource } from "@/lib/api";
  import { X, ToggleLeft, ToggleRight, Activity, Square } from "lucide-vue-next";
  import MarkdownContent from "@/components/MarkdownContent.vue";

  interface AgentEvent {
    id: string;
    task_id: string;
    type: string;
    summary: string;
    payload: string;
    created_at: string;
  }

  const props = defineProps<{
    taskId: string;
    taskDescription: string;
    taskStatus: string;
  }>();

  const emit = defineEmits<{
    close: [];
    stopped: [];
  }>();

  const events = ref<AgentEvent[]>([]);
  const rawMode = ref(false);
  const loading = ref(true);
  const stopping = ref(false);
  const feedContainer = ref<HTMLElement>();

  let eventSource: EventSource | null = null;

  // Computed: filter out events with empty summary
  const visibleEvents = computed(() => events.value.filter((e) => e.summary.trim() !== ""));

  // Current live message delta (not yet persisted as a full message event)
  const liveMessage = ref("");

  async function loadEvents() {
    try {
      const data = await apiGet<AgentEvent[]>(`/tasks/${props.taskId}/events`);
      events.value = data;
    } finally {
      loading.value = false;
    }
  }

  function scrollToBottom() {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight;
    }
  }

  function connectSSE() {
    if (props.taskStatus !== "pending" && props.taskStatus !== "in_progress") return;

    eventSource = createEventSource();
    eventSource.addEventListener("agent_event", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.taskId !== props.taskId) return;

      if (data.type === "message_delta") {
        // Live streaming content — update in-memory only
        liveMessage.value = data.summary ?? "";
        nextTick(scrollToBottom);
      } else {
        // Persisted event — reload from server
        loadEvents().then(() => nextTick(scrollToBottom));
        liveMessage.value = "";
      }
    });
  }

  async function stopAgent() {
    if (stopping.value) return;
    stopping.value = true;
    try {
      await apiPost(`/tasks/${props.taskId}/stop`);
      emit("stopped");
    } catch (err) {
      console.error("Failed to stop agent:", err);
    } finally {
      stopping.value = false;
    }
  }

  function humanReadableType(type: string): string {
    switch (type) {
      case "status":
        return "Status";
      case "message":
        return "Agent message";
      case "message_delta":
        return "Streaming…";
      default:
        return type;
    }
  }

  function formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString();
  }

  watch(
    () => props.taskStatus,
    (newStatus) => {
      if (newStatus === "done" || newStatus === "failed" || newStatus === "stopped") {
        liveMessage.value = "";
        loadEvents();
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    }
  );

  onMounted(() => {
    loadEvents().then(() => nextTick(scrollToBottom));
    connectSSE();
  });

  onUnmounted(() => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  });
</script>

<template>
  <div class="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
      <div class="flex items-center gap-2 min-w-0">
        <Activity class="w-4 h-4 text-primary flex-shrink-0" />
        <h3 class="text-sm font-semibold truncate">Activity Preview</h3>
        <span
          class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          :class="{
            'bg-yellow-500/10 text-yellow-500': taskStatus === 'pending',
            'bg-blue-500/10 text-blue-500': taskStatus === 'in_progress',
            'bg-green-500/10 text-green-500': taskStatus === 'done',
            'bg-red-500/10 text-red-500': taskStatus === 'failed',
            'bg-orange-500/10 text-orange-500': taskStatus === 'stopped',
          }"
        >
          {{ taskStatus }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Stop button (visible when task is active) -->
        <button
          v-if="taskStatus === 'pending' || taskStatus === 'in_progress'"
          @click="stopAgent"
          :disabled="stopping"
          class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Stop agent"
          title="Stop agent"
        >
          <Square class="w-3 h-3" />
          {{ stopping ? "Stopping…" : "Stop" }}
        </button>
        <!-- Human-readable / Raw JSON toggle -->
        <button
          @click="rawMode = !rawMode"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          :aria-label="rawMode ? 'Switch to human-readable view' : 'Switch to raw JSON view'"
          :title="rawMode ? 'Switch to human-readable view' : 'Switch to raw JSON view'"
        >
          <ToggleLeft v-if="!rawMode" class="w-4 h-4" />
          <ToggleRight v-else class="w-4 h-4 text-primary" />
          <span>{{ rawMode ? "Raw JSON" : "Readable" }}</span>
        </button>
        <button
          @click="emit('close')"
          class="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close preview"
          title="Close preview"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Task description -->
    <div
      class="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/10 truncate"
    >
      {{ taskDescription }}
    </div>

    <!-- Event feed -->
    <div ref="feedContainer" class="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
      <div v-if="loading" class="text-muted-foreground text-xs">Loading events…</div>

      <div
        v-else-if="visibleEvents.length === 0 && !liveMessage"
        class="text-muted-foreground text-xs"
      >
        No events yet. The agent will start shortly.
      </div>

      <!-- Persisted events -->
      <div
        v-for="event in visibleEvents"
        :key="event.id"
        class="border border-border rounded-lg p-3"
        :class="{
          'border-l-2 border-l-green-500':
            event.type === 'status' && event.summary.includes('completed'),
          'border-l-2 border-l-red-500':
            event.type === 'status' && event.summary.includes('failed'),
          'border-l-2 border-l-blue-500': event.type === 'message',
          'border-l-2 border-l-primary':
            event.type === 'status' &&
            !event.summary.includes('completed') &&
            !event.summary.includes('failed'),
        }"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {{ humanReadableType(event.type) }}
          </span>
          <span class="text-xs text-muted-foreground">{{ formatTime(event.created_at) }}</span>
        </div>

        <!-- Raw JSON view -->
        <pre
          v-if="rawMode"
          class="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all"
          >{{ JSON.stringify(JSON.parse(event.payload), null, 2) }}</pre
        >

        <!-- Human-readable view -->
        <div v-else>
          <MarkdownContent
            v-if="event.type === 'message'"
            :content="event.summary"
            class="text-sm"
          />
          <p v-else class="text-sm">{{ event.summary }}</p>
        </div>
      </div>

      <!-- Live streaming message (not yet persisted) -->
      <div
        v-if="liveMessage.trim()"
        class="border border-border border-l-2 border-l-yellow-500 rounded-lg p-3 animate-pulse"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agent is responding…
          </span>
          <span class="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-ping"></span>
        </div>

        <!-- Raw JSON view for live delta -->
        <pre
          v-if="rawMode"
          class="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all"
          >{{ JSON.stringify({ type: "message_delta", accumulated: liveMessage }, null, 2) }}</pre
        >

        <!-- Human-readable live content -->
        <MarkdownContent v-else :content="liveMessage" class="text-sm" />
      </div>
    </div>
  </div>
</template>
