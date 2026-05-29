<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { apiGet, apiPost, apiDelete } from "@/lib/api";
  import { Inbox, Check, Trash2 } from "lucide-vue-next";
  import MarkdownContent from "@/components/MarkdownContent.vue";
  import { getSquadLabelStyle } from "@/lib/squad-colors";

  interface FeedItem {
    id: string;
    source: string;
    title: string;
    content: string;
    read: number;
    created_at: string;
  }

  interface Squad {
    id: string;
    name: string;
    color: string;
  }

  const items = ref<FeedItem[]>([]);
  const squads = ref<Squad[]>([]);
  const unreadCount = ref(0);
  const filter = ref<"all" | "unread">("all");
  const loading = ref(true);
  const expandedId = ref<string | null>(null);

  async function loadFeed() {
    loading.value = true;
    try {
      const data = await apiGet(`/feed?unread=${filter.value === "unread"}`);
      items.value = data.items;
      unreadCount.value = data.unreadCount;
    } finally {
      loading.value = false;
    }
  }

  async function loadSquads() {
    const data = await apiGet("/squads");
    squads.value = data.squads;
  }

  async function markRead(id: string) {
    await apiPost(`/feed/${id}/read`);
    const item = items.value.find((i) => i.id === id);
    if (item) {
      item.read = 1;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }

  async function deleteItem(id: string) {
    await apiDelete(`/feed/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
  }

  function toggle(id: string) {
    expandedId.value = expandedId.value === id ? null : id;
    if (expandedId.value === id) markRead(id);
  }

  function getSquadForSource(source: string): Squad | undefined {
    if (!source.startsWith("squad-")) return undefined;
    const squadId = source.slice("squad-".length);
    return squads.value.find((s) => s.id === squadId);
  }

  const decoratedItems = computed(() =>
    items.value.map((item) => {
      const squad = getSquadForSource(item.source);
      return { ...item, squad };
    })
  );

  onMounted(async () => {
    await Promise.all([loadFeed(), loadSquads()]);
  });
  function getSourceLabel(item: FeedItem & { squad?: Squad }): string {
    return item.squad?.name ?? item.source;
  }
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Feed</h1>
      <div class="flex gap-2">
        <button
          v-for="f in ['all', 'unread'] as const"
          :key="f"
          @click="
            filter = f;
            loadFeed();
          "
          class="px-3 py-1.5 text-xs rounded-md border transition-colors"
          :class="
            filter === f
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          "
        >
          {{ f === "all" ? "All" : `Unread (${unreadCount})` }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="items.length === 0" class="text-center py-12 text-muted-foreground">
      <Inbox class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No feed items.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in decoratedItems"
        :key="item.id"
        class="border border-border rounded-lg overflow-hidden"
        :class="{ 'border-l-2 border-l-primary': !item.read }"
      >
        <div
          @click="toggle(item.id)"
          class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="{ 'bg-secondary text-secondary-foreground': !item.squad }"
                :style="item.squad ? getSquadLabelStyle(item.squad.color) : {}"
              >
                {{ getSourceLabel(item) }}
              </span>
              <span class="text-sm font-medium truncate" :class="{ 'font-bold': !item.read }">
                {{ item.title }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">{{ item.created_at }}</p>
          </div>
          <div class="flex gap-1">
            <button
              v-if="!item.read"
              @click.stop="markRead(item.id)"
              class="p-1.5 rounded hover:bg-accent text-muted-foreground"
              title="Mark as read"
            >
              <Check class="w-3.5 h-3.5" />
            </button>
            <button
              @click.stop="deleteItem(item.id)"
              class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div v-if="expandedId === item.id" class="px-4 pb-3 border-t border-border pt-3">
          <MarkdownContent :content="item.content" />
        </div>
      </div>
    </div>
  </div>
</template>
