<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { apiGet, apiDelete } from "@/lib/api";
import { History, Search, Trash2, ArrowLeft, MessageSquare } from "lucide-vue-next";
import MarkdownContent from "@/components/MarkdownContent.vue";

interface ConversationSummary {
  id: string;
  preview: string;
  messageCount: number;
  startedAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  source: string;
  createdAt: string;
}

const conversations = ref<ConversationSummary[]>([]);
const total = ref(0);
const loading = ref(true);
const searchQuery = ref("");
const dateFrom = ref("");
const dateTo = ref("");
const selectedConversation = ref<string | null>(null);
const selectedMessages = ref<ConversationMessage[]>([]);
const threadLoading = ref(false);

const limit = 50;
const offset = ref(0);

async function loadConversations(reset = true) {
  loading.value = true;
  try {
    if (reset) {
      offset.value = 0;
      conversations.value = [];
    }
    const params = new URLSearchParams();
    if (searchQuery.value) params.set("q", searchQuery.value);
    if (dateFrom.value) params.set("from", dateFrom.value);
    if (dateTo.value) params.set("to", dateTo.value + "T23:59:59");
    params.set("limit", String(limit));
    params.set("offset", String(offset.value));

    const result = await apiGet<{ items: ConversationSummary[]; total: number }>(
      `/history?${params.toString()}`
    );
    conversations.value = reset
      ? result.items
      : [...conversations.value, ...result.items];
    total.value = result.total;
    offset.value += result.items.length;
  } finally {
    loading.value = false;
  }
}

async function openConversation(id: string) {
  selectedConversation.value = id;
  threadLoading.value = true;
  try {
    selectedMessages.value = await apiGet<ConversationMessage[]>(`/history/${id}`);
  } finally {
    threadLoading.value = false;
  }
}

function closeThread() {
  selectedConversation.value = null;
  selectedMessages.value = [];
}

async function deleteConversation(id: string, e: Event) {
  e.stopPropagation();
  if (!confirm("Delete this conversation?")) return;
  await apiDelete(`/history/${id}`);
  conversations.value = conversations.value.filter((c) => c.id !== id);
  total.value = Math.max(0, total.value - 1);
  if (selectedConversation.value === id) closeThread();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max = 100): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const hasMore = computed(() => conversations.value.length < total.value);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch([searchQuery, dateFrom, dateTo], () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadConversations(true), 300);
});

onMounted(() => loadConversations(true));
</script>

<template>
  <div class="flex h-full">
    <!-- Conversation List -->
    <div
      class="flex flex-col border-r border-border"
      :class="selectedConversation ? 'hidden md:flex w-80 shrink-0' : 'flex-1'"
    >
      <!-- Header + filters -->
      <div class="p-3 border-b border-border space-y-2">
        <div class="flex items-center gap-2">
          <History class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">Conversation History</span>
        </div>
        <div class="relative">
          <Search class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input
            v-model="searchQuery"
            placeholder="Search conversations..."
            class="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-xs text-muted-foreground block mb-1">From</label>
            <input
              v-model="dateFrom"
              type="date"
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div class="flex-1">
            <label class="text-xs text-muted-foreground block mb-1">To</label>
            <input
              v-model="dateTo"
              type="date"
              class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loading && conversations.length === 0" class="p-4 text-xs text-muted-foreground">
          Loading...
        </div>
        <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
          <MessageSquare class="w-10 h-10 mb-3 opacity-40" />
          <p class="text-sm">No conversations found.</p>
          <p class="text-xs mt-1">Start chatting to build up your history.</p>
        </div>

        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="group flex items-start gap-2 px-3 py-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors"
          :class="selectedConversation === conv.id ? 'bg-accent' : ''"
          @click="openConversation(conv.id)"
        >
          <div class="flex-1 min-w-0">
            <p class="text-xs text-foreground line-clamp-2">{{ truncate(conv.preview) }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-muted-foreground">{{ formatDate(conv.updatedAt) }}</span>
              <span class="text-xs text-muted-foreground">· {{ conv.messageCount }} msgs</span>
            </div>
          </div>
          <button
            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
            title="Delete"
            @click="deleteConversation(conv.id, $event)"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>

        <div v-if="hasMore" class="p-3 text-center">
          <button
            class="text-xs text-muted-foreground hover:text-foreground underline"
            @click="loadConversations(false)"
          >
            Load more
          </button>
        </div>
      </div>
    </div>

    <!-- Thread View -->
    <div v-if="selectedConversation" class="flex-1 flex flex-col">
      <!-- Toolbar -->
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          class="p-1.5 rounded hover:bg-accent text-muted-foreground"
          title="Back"
          @click="closeThread"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <span class="text-sm font-medium text-muted-foreground">
          {{ formatDate(conversations.find(c => c.id === selectedConversation)?.startedAt ?? "") }}
        </span>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="threadLoading" class="text-center text-xs text-muted-foreground py-8">
          Loading...
        </div>
        <div
          v-for="msg in selectedMessages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[75%] rounded-lg px-4 py-2 text-sm"
            :class="
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-muted text-foreground'
            "
          >
            <MarkdownContent
              v-if="msg.content"
              :content="msg.content"
              :class="msg.role === 'user' ? 'prose-invert' : ''"
            />
            <p class="text-xs mt-1 opacity-60">{{ formatDate(msg.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state when no conversation selected and list is visible -->
    <div
      v-else-if="!selectedConversation"
      class="hidden md:flex flex-1 items-center justify-center text-muted-foreground"
    >
      <div class="text-center">
        <History class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select a conversation to view</p>
      </div>
    </div>
  </div>
</template>
