<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useChatStore } from "@/stores/chat";
import { useRoute } from "vue-router";
import { Send, Square, X, Image as ImageIcon, FileText, ChevronDown, MessageSquare, Paperclip } from "lucide-vue-next";
import LogoIcon from "@/components/LogoIcon.vue";
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
const streamingDotDelays = [0, 110, 220];

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
    <MessageSquare class="h-4 w-4 text-white" />
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
      <header
        class="overlay-header"
        style="background: linear-gradient(135deg, rgba(216,51,51,0.18) 0%, rgba(240,65,255,0.10) 100%);"
      >
        <div class="flex items-center gap-2.5">
          <div class="overlay-brand-mark" aria-hidden="true">
            <LogoIcon :size="18" class="shrink-0" />
          </div>
          <div class="flex flex-col leading-none">
            <span class="overlay-title">IO</span>
            <span class="overlay-quick-chat">quick chat</span>
          </div>
        </div>

        <button
          @click="isOpen = false"
          class="overlay-icon-btn"
          aria-label="Close chat overlay"
          title="Close chat"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </header>

      <div ref="messagesContainer" class="overlay-messages" @scroll="updateScrollState">
        <div v-if="!hasMessages" class="flex h-full items-center justify-center px-5 text-center">
          <div>
            <p class="overlay-empty-title">CHAT</p>
            <p class="overlay-empty-copy">Ask IO about your workspace, agents, or recent changes.</p>
          </div>
        </div>

        <div
          v-for="msg in chat.messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div class="flex max-w-full items-start gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
            <div
              class="overlay-avatar"
              :class="msg.role === 'user' ? 'overlay-avatar-user' : 'overlay-avatar-assistant'"
              aria-hidden="true"
            >
              <span v-if="msg.role === 'user'" class="overlay-avatar-letter">U</span>
              <LogoIcon v-else :size="10" class="shrink-0" />
            </div>

            <article
              class="overlay-bubble"
              :class="msg.role === 'user' ? 'overlay-bubble-user rounded-tr-sm' : 'overlay-bubble-assistant rounded-tl-sm'"
            >
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
                    class="mb-1 max-h-44 rounded-md object-contain"
                  />
                  <div class="flex items-center gap-2 text-[10px]">
                    <ImageIcon v-if="isImageAttachment(attachment)" class="h-3.5 w-3.5" />
                    <FileText v-else class="h-3.5 w-3.5" />
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
              <span v-else class="text-zinc-500">...</span>
            </article>
          </div>

          <div
            v-if="msg.streaming && msg.role === 'assistant'"
            class="overlay-stream-indicator"
          >
            <span
              v-for="delay in streamingDotDelays"
              :key="delay"
              class="overlay-stream-dot"
              :style="{ animationDelay: `${delay}ms` }"
            />
          </div>
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
              <ImageIcon v-if="isImageAttachment(attachment)" class="h-3.5 w-3.5" />
              <FileText v-else class="h-3.5 w-3.5" />
              <span class="max-w-[120px] truncate">{{ attachment.name }}</span>
              <span class="opacity-65">{{ formatAttachmentSize(attachment.size) }}</span>
              <button class="hover:text-destructive" @click="removeAttachment(idx)">
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p class="overlay-meta text-zinc-500">
            {{ formatAttachmentSize(totalPendingAttachmentBytes) }} · Max {{ formatAttachmentSize(MAX_ATTACHMENT_BYTES) }} file · {{ formatAttachmentSize(MAX_TOTAL_ATTACHMENT_BYTES) }} total
          </p>
        </div>

        <p v-if="composerError" class="mb-2 text-[11px] text-[#ef4444]">{{ composerError }}</p>

        <div class="flex items-end gap-2">
          <button
            class="overlay-attach-btn"
            :disabled="chat.isStreaming"
            @click="openPicker"
            title="Attach files"
            aria-label="Attach files"
          >
            <Paperclip class="h-4 w-4" />
          </button>

          <div class="overlay-composer-field">
            <textarea
              ref="textareaRef"
              v-model="input"
              @keydown="handleKeydown"
              placeholder="Message IO…"
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
              <Send v-if="!chat.isStreaming" class="h-3 w-3" />
              <Square v-else class="h-3 w-3" />
            </button>
          </div>
        </div>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.overlay-fab {
  @apply fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-xl transition-all duration-150 sm:bottom-6 sm:right-6;
  background: linear-gradient(135deg, #D83333 0%, #E43A9C 55%, #F041FF 100%);
}

.overlay-fab:hover {
  @apply scale-105;
}

.overlay-fab:active {
  @apply scale-95;
}

.overlay-fab:focus-visible {
  @apply outline-none ring-2 ring-[#E43A9C] ring-offset-2 ring-offset-[#1a1a1a];
}

.overlay-panel {
  @apply fixed bottom-5 right-5 z-50 flex h-[460px] w-[340px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] shadow-2xl;
  background: #1c1c1c;
}

.overlay-panel-dragging {
  @apply ring-2 ring-[#E43A9C]/40;
}

.overlay-header {
  @apply flex flex-shrink-0 items-center justify-between px-4 py-3 border-b border-white/[0.07];
}

.overlay-brand-mark {
  @apply flex h-5 w-5 items-center justify-center;
}

.overlay-title {
  font-family: "Bebas Neue", sans-serif;
  @apply text-lg leading-none tracking-[0.16em] text-white;
}

.overlay-quick-chat {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  @apply mt-0.5 text-[10px] text-zinc-600;
}

.overlay-icon-btn {
  @apply rounded-lg p-1.5 text-zinc-500 transition-colors duration-150;
}

.overlay-icon-btn:hover {
  @apply bg-white/[0.07] text-zinc-200;
}

.overlay-icon-btn:focus-visible {
  @apply outline-none ring-2 ring-[#E43A9C] ring-offset-2 ring-offset-[#1c1c1c];
}

.overlay-messages {
  @apply relative flex-1 space-y-3 overflow-y-auto px-3 py-3;
  background: #1c1c1c;
}

.overlay-empty-title {
  font-family: "Bebas Neue", sans-serif;
  @apply text-3xl leading-none tracking-[0.12em] text-white;
}

.overlay-empty-copy {
  @apply mt-2 text-xs text-zinc-500;
  font-family: "Inter", sans-serif;
}

.overlay-avatar {
  @apply mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold;
}

.overlay-avatar-assistant {
  background: #282828;
  border-color: rgba(255, 255, 255, 0.07);
}

.overlay-avatar-user {
  border-color: rgba(228, 58, 156, 0.3);
  background: rgba(228, 58, 156, 0.12);
  color: #E43A9C;
}

.overlay-avatar-letter {
  @apply leading-none;
}

.overlay-bubble {
  @apply max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed;
}

.overlay-bubble-assistant {
  background: #282828;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgb(228 228 231);
}

.overlay-bubble-user {
  background: linear-gradient(135deg, #D83333 0%, #C0285E 100%);
  color: #fff;
}

.overlay-attachment {
  @apply rounded-lg border border-white/[0.06] bg-[#252525]/90 p-2 text-[10px] text-zinc-200;
}

.overlay-markdown :deep(p:last-child) {
  @apply mb-0;
}

.overlay-markdown :deep(pre) {
  @apply rounded-lg border border-white/[0.06] bg-[#1f1f1f] p-0;
}

.overlay-markdown :deep(pre code) {
  @apply block overflow-x-auto px-3 py-2 text-[11px];
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-stream-indicator {
  @apply mt-1 flex w-fit items-center gap-1 rounded-xl rounded-tl-sm border border-white/[0.06] bg-[#282828] px-3 py-2.5;
}

.overlay-stream-dot {
  @apply h-1 w-1 rounded-full bg-[#E43A9C];
  animation: bounce 1s infinite;
}

.overlay-scroll-hint {
  @apply absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.08] bg-[#252525]/95 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-footer {
  @apply flex-shrink-0 border-t border-white/[0.06] bg-[#1c1c1c] p-2.5;
}

.overlay-chip {
  @apply flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#2c2c2c] px-1.5 py-1 text-[10px] text-zinc-200;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.overlay-attach-btn {
  @apply flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#252525] text-zinc-500 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45;
}

.overlay-attach-btn:hover:not(:disabled) {
  @apply border-white/[0.12] bg-[#2a2a2a] text-zinc-300;
}

.overlay-attach-btn:focus-visible {
  @apply outline-none ring-2 ring-[#E43A9C] ring-offset-2 ring-offset-[#1c1c1c];
}

.overlay-composer-field {
  @apply relative flex-1;
}

.overlay-input {
  @apply min-h-[36px] w-full resize-none rounded-xl border border-white/[0.08] bg-[#252525] px-3 py-2 pr-10 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-700 transition-colors duration-150 focus:outline-none;
  max-height: 100px;
  font-family: "Inter", sans-serif;
}

.overlay-input:focus {
  border-color: rgba(228, 58, 156, 0.3);
}

.overlay-send-btn {
  @apply absolute bottom-1 right-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-30;
  background: linear-gradient(135deg, #D83333, #E43A9C);
}

.overlay-send-btn:hover:not(:disabled) {
  @apply brightness-110;
}

.overlay-send-btn:active:not(:disabled) {
  @apply brightness-100;
}

.overlay-send-btn:focus-visible {
  @apply outline-none ring-2 ring-[#E43A9C] ring-offset-2 ring-offset-[#252525];
}

.overlay-meta {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
</style>
