<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useChatStore } from "@/stores/chat";
import { useRoute } from "vue-router";
import {
  MessageCircle,
  Send,
  Square,
  Minimize2,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  ChevronDown,
} from "lucide-vue-next";
import MarkdownContent from "@/components/MarkdownContent.vue";
import {
  fileToMessageAttachment,
  formatAttachmentSize,
  isImageAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  toDataUrl,
  type MessageAttachment,
  validateAttachmentSizes,
} from "@/lib/attachments";

const chat = useChatStore();
const route = useRoute();

const isOpen = ref(false);
const input = ref("");
const composerError = ref("");
const isDragging = ref(false);
const pendingAttachments = ref<MessageAttachment[]>([]);

const messagesContainer = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const textareaRef = ref<HTMLTextAreaElement>();

const isNearBottom = ref(true);
const showScrollHint = ref(false);

const hasMessages = computed(() => chat.messages.length > 0);
const isOnChatPage = () => route.path === "/";

const totalPendingAttachmentBytes = computed(() =>
  pendingAttachments.value.reduce((sum, attachment) => sum + attachment.size, 0)
);

const canSend = computed(
  () =>
    !chat.isStreaming &&
    (input.value.trim().length > 0 || pendingAttachments.value.length > 0)
);

function toggle() {
  if (isOnChatPage()) return;
  isOpen.value = !isOpen.value;
}

function updateComposerHeight(): void {
  if (!textareaRef.value) return;
  textareaRef.value.style.height = "auto";
  textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 136)}px`;
}

function updateScrollState(): void {
  if (!messagesContainer.value) return;
  const el = messagesContainer.value;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  isNearBottom.value = distanceFromBottom < 40;
  showScrollHint.value = !isNearBottom.value;
}

function scrollToBottom(force = false) {
  if (!messagesContainer.value) return;
  if (force || isNearBottom.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    showScrollHint.value = false;
  }
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function queueAttachments(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;

  composerError.value = "";
  const parsed: MessageAttachment[] = [];

  try {
    for (const file of Array.from(files)) {
      parsed.push(await fileToMessageAttachment(file));
    }
  } catch (err: any) {
    composerError.value = err?.message ?? "Unable to read one or more files.";
    return;
  }

  const next = [...pendingAttachments.value, ...parsed];
  const validation = validateAttachmentSizes(next);
  if (!validation.ok) {
    composerError.value = validation.error;
    return;
  }

  pendingAttachments.value = next;
  if (fileInput.value) fileInput.value.value = "";
}

function removeAttachment(index: number): void {
  pendingAttachments.value.splice(index, 1);
  composerError.value = "";
}

function openPicker(): void {
  if (chat.isStreaming) return;
  fileInput.value?.click();
}

function handleFileInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  void queueAttachments(target?.files ?? null);
}

async function send() {
  if (!canSend.value) return;

  const text = input.value.trim();
  const attachments = [...pendingAttachments.value];
  const prompt = text || "Please review the attached file(s).";

  input.value = "";
  pendingAttachments.value = [];
  composerError.value = "";
  updateComposerHeight();

  await chat.sendMessage(prompt, attachments);
}

function stopStreaming(): void {
  chat.stopStreaming();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (chat.isStreaming) {
      stopStreaming();
      return;
    }
    void send();
  }
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  if (chat.isStreaming) return;
  isDragging.value = true;
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  isDragging.value = false;
  if (chat.isStreaming) return;
  await queueAttachments(event.dataTransfer?.files ?? null);
}

watch(input, () => updateComposerHeight());

watch(
  () => chat.messages.map((m) => m.content),
  async () => {
    await nextTick();
    updateScrollState();
    scrollToBottom();
  },
  { deep: true }
);

watch(
  () => chat.messages.length,
  async () => {
    await nextTick();
    updateScrollState();
    scrollToBottom(true);
  }
);

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  updateComposerHeight();
  updateScrollState();
  scrollToBottom(true);
});

onMounted(async () => {
  await nextTick();
  updateComposerHeight();
});
</script>

<template>
  <button
    v-if="!isOpen && !isOnChatPage()"
    @click="toggle"
    class="overlay-fab"
    title="Chat with IO"
    aria-label="Open chat overlay"
  >
    <MessageCircle class="h-5 w-5 text-white" />
    <span class="overlay-fab-label">IO</span>
  </button>

  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-[0.98]"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-[0.98]"
  >
    <section
      v-if="isOpen"
      class="overlay-panel"
      :class="isDragging ? 'overlay-panel-dragging' : ''"
      aria-label="IO Assistant chat"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <header class="overlay-header">
        <div class="flex items-center gap-3">
          <div class="overlay-status-dot" />
          <div>
            <p class="overlay-title">IO ASSISTANT</p>
            <p class="overlay-meta">LIVE</p>
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

      <div ref="messagesContainer" class="overlay-messages" @scroll="updateScrollState">
        <div v-if="!hasMessages" class="flex h-full items-center justify-center px-8">
          <div class="text-center">
            <p class="overlay-title text-3xl">CHAT</p>
            <p class="mt-2 text-sm text-muted-foreground">Ask IO about your workspace, agents, or recent changes.</p>
          </div>
        </div>

        <div
          v-for="msg in chat.messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <article class="overlay-bubble" :class="msg.role === 'user' ? 'overlay-bubble-user' : 'overlay-bubble-assistant'">
            <div v-if="msg.attachments.length > 0" class="mb-2 space-y-2">
              <div
                v-for="(attachment, idx) in msg.attachments"
                :key="`${msg.id}-${idx}`"
                class="overlay-attachment"
              >
                <img
                  v-if="isImageAttachment(attachment)"
                  :src="toDataUrl(attachment)"
                  :alt="attachment.name"
                  class="max-h-44 rounded-md mb-1 object-contain"
                />
                <div class="flex items-center gap-2 text-xs">
                  <ImageIcon v-if="isImageAttachment(attachment)" class="w-3.5 h-3.5" />
                  <FileText v-else class="w-3.5 h-3.5" />
                  <span class="truncate">{{ attachment.name }}</span>
                  <span class="opacity-70">{{ formatAttachmentSize(attachment.size) }}</span>
                </div>
              </div>
            </div>

            <MarkdownContent
              v-if="msg.content"
              :content="msg.content"
              class="overlay-markdown"
              :class="msg.role === 'user' ? 'prose-invert' : ''"
            />
            <span v-else class="text-muted-foreground">...</span>

            <div class="mt-2 flex items-center justify-between gap-3">
              <span class="overlay-meta uppercase tracking-[0.18em]" :class="msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'">
                {{ msg.role }}
              </span>
              <span class="overlay-meta" :class="msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'">
                {{ formatTimestamp(msg.timestamp) }}
              </span>
            </div>

            <div v-if="msg.streaming" class="mt-2 inline-flex items-center gap-1" aria-label="Streaming response">
              <span class="overlay-dot animate-pulse" />
              <span class="overlay-dot animate-pulse [animation-delay:140ms]" />
              <span class="overlay-dot animate-pulse [animation-delay:280ms]" />
            </div>
          </article>
        </div>
      </div>

      <button
        v-if="showScrollHint"
        class="overlay-scroll-hint"
        type="button"
        @click="scrollToBottom(true)"
        aria-label="Scroll to latest message"
      >
        <ChevronDown class="h-3.5 w-3.5" />
        Latest
      </button>

      <footer class="overlay-footer">
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="handleFileInput"
        />

        <div v-if="pendingAttachments.length > 0" class="mb-2 space-y-2">
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="(attachment, idx) in pendingAttachments"
              :key="`${attachment.name}-${idx}`"
              class="overlay-chip"
            >
              <ImageIcon v-if="isImageAttachment(attachment)" class="w-3.5 h-3.5" />
              <FileText v-else class="w-3.5 h-3.5" />
              <span class="max-w-[120px] truncate">{{ attachment.name }}</span>
              <span class="opacity-65">{{ formatAttachmentSize(attachment.size) }}</span>
              <button class="hover:text-destructive" @click="removeAttachment(idx)">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p class="overlay-meta text-muted-foreground">
            {{ formatAttachmentSize(totalPendingAttachmentBytes) }} · Max {{ formatAttachmentSize(MAX_ATTACHMENT_BYTES) }} file · {{ formatAttachmentSize(MAX_TOTAL_ATTACHMENT_BYTES) }} total
          </p>
        </div>

        <p v-if="composerError" class="text-xs text-destructive mb-2">{{ composerError }}</p>

        <div class="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#202020]/90 px-2 py-2">
          <button
            class="overlay-attach-btn"
            :disabled="chat.isStreaming"
            @click="openPicker"
            title="Attach files"
            aria-label="Attach files"
          >
            <Paperclip class="w-4 h-4" />
          </button>

          <textarea
            ref="textareaRef"
            v-model="input"
            @keydown="handleKeydown"
            placeholder="Message IO..."
            rows="1"
            class="overlay-input"
          />

          <button
            @click="chat.isStreaming ? stopStreaming() : send()"
            :disabled="!canSend && !chat.isStreaming"
            class="overlay-send-btn"
            :aria-label="chat.isStreaming ? 'Stop generation' : 'Send message'"
            :title="chat.isStreaming ? 'Stop generation' : 'Send message'"
          >
            <Send v-if="!chat.isStreaming" class="h-4 w-4" />
            <Square v-else class="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.overlay-fab {
  @apply fixed bottom-4 right-4 z-50 flex h-12 items-center gap-2 rounded-full px-4 text-white shadow-glow-lg transition-all duration-200 sm:bottom-6 sm:right-6;
  background: linear-gradient(
    135deg,
    hsl(var(--gradient-start)),
    hsl(var(--gradient-mid)),
    hsl(var(--gradient-end))
  );
}

.overlay-fab-label {
  font-family: "Bebas Neue", "Inter", sans-serif;
  @apply text-lg leading-none tracking-[0.1em];
}

.overlay-fab:hover {
  @apply -translate-y-0.5 scale-[1.02] shadow-glow;
}

.overlay-fab:active {
  @apply translate-y-0 scale-100;
}

.overlay-fab:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
}

.overlay-panel {
  @apply fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] flex-col overflow-hidden border border-white/5 bg-[#1e1e1e]/95 shadow-2xl backdrop-blur;
}

@media (min-width: 768px) {
  .overlay-panel {
    @apply bottom-4 right-4 left-auto h-[min(44rem,85vh)] w-[min(27rem,calc(100vw-2.25rem))] rounded-3xl;
  }
}

@media (min-width: 1024px) {
  .overlay-panel {
    @apply bottom-6 right-6 h-[min(46rem,86vh)] w-[29rem];
  }
}

.overlay-panel-dragging {
  @apply ring-2 ring-primary/50;
}

.overlay-header {
  @apply flex items-center justify-between border-b border-border/80 bg-header/85 px-4 py-3;
}

.overlay-status-dot {
  @apply h-2.5 w-2.5 rounded-full bg-emerald-400;
  box-shadow: 0 0 0 4px rgb(52 211 153 / 0.14);
}

.overlay-title {
  font-family: "Bebas Neue", "Inter", sans-serif;
  @apply text-xl leading-none tracking-[0.08em] text-foreground;
}

.overlay-meta {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  @apply text-[10px] leading-4;
}

.overlay-icon-btn {
  @apply rounded-md p-1.5 text-muted-foreground transition-colors duration-150;
}

.overlay-icon-btn:hover {
  @apply bg-accent text-foreground;
}

.overlay-icon-btn:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-card;
}

.overlay-messages {
  @apply relative flex-1 space-y-3 overflow-y-auto px-3 py-3.5 md:px-4;
  background:
    radial-gradient(circle at 25% 0%, hsl(var(--primary) / 0.08), transparent 30%),
    linear-gradient(180deg, hsl(var(--background)), hsl(var(--card)));
}

.overlay-bubble {
  @apply max-w-[90%] rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed md:max-w-[84%];
}

.overlay-bubble-assistant {
  @apply border-white/5 bg-[#232323] text-foreground shadow-sm;
}

.overlay-bubble-user {
  @apply border-transparent text-primary-foreground;
  background: linear-gradient(
    135deg,
    hsl(var(--gradient-start) / 0.9),
    hsl(var(--gradient-mid) / 0.95),
    hsl(var(--gradient-end) / 0.92)
  );
}

.overlay-dot {
  @apply h-1.5 w-1.5 rounded-full bg-current;
}

.overlay-attachment {
  @apply rounded-lg border border-border/60 bg-background/60 p-2 text-foreground;
}

.overlay-markdown :deep(p:last-child) {
  @apply mb-0;
}

.overlay-markdown :deep(pre) {
  @apply rounded-lg border border-border/80 bg-background/65 p-0;
}

.overlay-markdown :deep(pre code) {
  @apply block overflow-x-auto px-3 py-2 text-[12px] font-medium;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-scroll-hint {
  @apply absolute bottom-[9.25rem] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-footer {
  @apply border-t border-white/5 bg-[#1f1f1f]/95 p-3;
}

.overlay-chip {
  @apply flex items-center gap-1.5 rounded-full border border-white/5 bg-[#2a2a2a]/90 px-1.5 py-1 text-[11px] text-foreground;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-input {
  @apply min-h-[42px] max-h-[136px] flex-1 resize-none rounded-full border border-white/5 bg-[#2a2a2a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150;
}

.overlay-input:hover {
  @apply border-border;
}

.overlay-input:focus {
  @apply outline-none;
}

.overlay-input:focus-visible {
  @apply border-ring ring-2 ring-ring ring-offset-1 ring-offset-card;
}

.overlay-attach-btn {
  @apply flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-[#2a2a2a] text-muted-foreground transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45;
}

.overlay-attach-btn:hover:not(:disabled) {
  @apply border-border bg-accent text-foreground;
}

.overlay-attach-btn:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-card;
}

.overlay-send-btn {
  @apply flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45;
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
