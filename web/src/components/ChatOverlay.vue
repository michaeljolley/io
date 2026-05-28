<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useChatStore } from "@/stores/chat";
import { useRoute } from "vue-router";
import { MessageCircle, Send, Square, Minimize2 } from "lucide-vue-next";
import MarkdownContent from "@/components/MarkdownContent.vue";

const chat = useChatStore();
const route = useRoute();
const isOpen = ref(false);
const input = ref("");
const messagesContainer = ref<HTMLElement>();

const hasMessages = computed(() => chat.messages.length > 0);

const isOnChatPage = () => route.path === "/";

function toggle() {
  if (isOnChatPage()) return;
  isOpen.value = !isOpen.value;
}

async function send() {
  const text = input.value.trim();
  if (!text || chat.isStreaming) return;
  input.value = "";
  await chat.sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void send();
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

watch(
  () => chat.messages.map((m) => m.content),
  async () => {
    await nextTick();
    scrollToBottom();
  },
  { deep: true }
);

watch(
  () => chat.messages.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);
</script>

<template>
  <button
    v-if="!isOpen && !isOnChatPage()"
    @click="toggle"
    class="overlay-fab"
    title="Chat with IO"
    aria-label="Open chat overlay"
  >
    <MessageCircle class="w-5 h-5 text-white" />
  </button>

  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-95"
  >
    <section v-if="isOpen" class="overlay-panel" aria-label="IO Assistant chat">
      <header class="overlay-header">
        <div class="flex items-center gap-3">
          <div class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p class="text-sm font-semibold tracking-tight">IO Assistant</p>
            <p class="text-[11px] text-muted-foreground font-mono">online</p>
          </div>
        </div>
        <button
          @click="isOpen = false"
          class="overlay-icon-btn"
          aria-label="Minimize chat overlay"
          title="Minimize"
        >
          <Minimize2 class="h-4 w-4" />
        </button>
      </header>

      <div ref="messagesContainer" class="overlay-messages">
        <div v-if="!hasMessages" class="flex h-full items-center justify-center">
          <div class="text-center">
            <div class="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MessageCircle class="h-4 w-4" />
            </div>
            <p class="text-sm font-medium">Start a quick chat</p>
            <p class="mt-1 text-xs text-muted-foreground">Ask IO anything about your workspace.</p>
          </div>
        </div>

        <div
          v-for="msg in chat.messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <article class="overlay-bubble" :class="msg.role === 'user' ? 'overlay-bubble-user' : 'overlay-bubble-assistant'">
            <MarkdownContent v-if="msg.content" :content="msg.content" :class="msg.role === 'user' ? 'prose-invert' : ''" />
            <span v-else class="text-muted-foreground">...</span>
            <div class="mt-1.5 flex items-center justify-between gap-3">
              <span class="text-[10px] uppercase tracking-[0.16em] font-mono" :class="msg.role === 'user' ? 'text-primary-foreground/65' : 'text-muted-foreground'">
                {{ msg.role }}
              </span>
              <span class="text-[10px] font-mono" :class="msg.role === 'user' ? 'text-primary-foreground/65' : 'text-muted-foreground'">
                {{ formatTimestamp(msg.timestamp) }}
              </span>
            </div>
            <span
              v-if="msg.streaming"
              class="mt-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-current"
            />
          </article>
        </div>
      </div>

      <footer class="overlay-footer">
        <div class="flex items-end gap-2">
          <textarea
            v-model="input"
            @keydown="handleKeydown"
            placeholder="Message IO..."
            rows="1"
            class="overlay-input"
          />
          <button
            @click="send"
            :disabled="!input.trim() || chat.isStreaming"
            class="overlay-send-btn"
            :aria-label="chat.isStreaming ? 'Stop generation' : 'Send message'"
            :title="chat.isStreaming ? 'Stop generation' : 'Send message'"
          >
            <Send v-if="!chat.isStreaming" class="h-3.5 w-3.5" />
            <Square v-else class="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.overlay-fab {
  @apply fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-glow-lg transition-all duration-200 sm:bottom-6 sm:right-6;
  background: linear-gradient(
    135deg,
    hsl(var(--gradient-start)),
    hsl(var(--gradient-mid)),
    hsl(var(--gradient-end))
  );
}

.overlay-fab:hover {
  @apply -translate-y-0.5 scale-[1.03] shadow-glow;
}

.overlay-fab:active {
  @apply translate-y-0 scale-100;
}

.overlay-fab:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
}

.overlay-panel {
  @apply fixed bottom-3 right-3 z-50 flex h-[min(36rem,72vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur sm:bottom-6 sm:right-6 sm:h-[34rem] sm:w-[24rem];
}

.overlay-header {
  @apply flex items-center justify-between border-b border-border/80 bg-header/85 px-4 py-3;
}

.overlay-icon-btn {
  @apply rounded-md p-1.5 text-muted-foreground transition-colors duration-150;
}

.overlay-icon-btn:hover {
  @apply bg-accent text-foreground;
}

.overlay-icon-btn:active {
  @apply bg-accent/80;
}

.overlay-icon-btn:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-card;
}

.overlay-messages {
  @apply flex-1 space-y-3 overflow-y-auto p-3.5;
}

.overlay-bubble {
  @apply max-w-[86%] rounded-xl border px-3 py-2.5 text-xs leading-relaxed;
}

.overlay-bubble-assistant {
  @apply border-border/80 bg-secondary text-foreground;
}

.overlay-bubble-user {
  @apply border-transparent text-primary-foreground;
  background: linear-gradient(
    135deg,
    hsl(var(--gradient-start) / 0.9),
    hsl(var(--gradient-mid) / 0.96),
    hsl(var(--gradient-end) / 0.92)
  );
}

.overlay-footer {
  @apply border-t border-border/80 bg-card/90 p-3;
}

.overlay-input {
  @apply min-h-[40px] max-h-[96px] flex-1 resize-none rounded-lg border border-input bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-colors duration-150;
}

.overlay-input:hover {
  @apply border-border;
}

.overlay-input:focus {
  @apply outline-none;
}

.overlay-input:focus-visible {
  @apply ring-2 ring-ring ring-offset-1 ring-offset-card border-ring;
}

.overlay-send-btn {
  @apply flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45;
  background: linear-gradient(
    135deg,
    hsl(var(--gradient-start)),
    hsl(var(--gradient-mid)),
    hsl(var(--gradient-end))
  );
}

.overlay-send-btn:hover:not(:disabled) {
  @apply -translate-y-0.5 brightness-110;
}

.overlay-send-btn:active:not(:disabled) {
  @apply translate-y-0 brightness-100;
}

.overlay-send-btn:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-card;
}
</style>
