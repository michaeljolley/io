<script setup lang="ts">
  import { computed, ref, nextTick, onMounted, watch } from "vue";
  import { useChatStore } from "@/stores/chat";
  import { Send, Square, Paperclip, X, Image as ImageIcon, FileText } from "lucide-vue-next";
  import MarkdownContent from "@/components/MarkdownContent.vue";
  import LogoIcon from "@/components/LogoIcon.vue";
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
  const input = ref("");
  const composerError = ref("");
  const messagesContainer = ref<HTMLElement>();
  const fileInput = ref<HTMLInputElement>();
  const pendingAttachments = ref<MessageAttachment[]>([]);
  const textareaRef = ref<HTMLTextAreaElement>();
  const isDragging = ref(false);

  const totalPendingAttachmentBytes = computed(() =>
    pendingAttachments.value.reduce((sum, attachment) => sum + attachment.size, 0)
  );

  const canSend = computed(
    () =>
      !chat.isStreaming && (input.value.trim().length > 0 || pendingAttachments.value.length > 0)
  );

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

    await chat.sendMessage(prompt, attachments);
  }

  function scrollToBottom() {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }

  function updateComposerHeight(): void {
    if (!textareaRef.value) return;
    textareaRef.value.style.height = "auto";
    textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 120)}px`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onDragOver(event: DragEvent): void {
    event.preventDefault();
    isDragging.value = true;
  }

  function onDragLeave(event: DragEvent): void {
    event.preventDefault();
    isDragging.value = false;
  }

  async function onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDragging.value = false;
    await queueAttachments(event.dataTransfer?.files ?? null);
  }

  // Auto-scroll whenever messages change (new message, streaming content updates)
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

  watch(
    () => input.value,
    async () => {
      await nextTick();
      updateComposerHeight();
    }
  );

  onMounted(() => {
    updateComposerHeight();
    scrollToBottom();
  });
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="chat.messages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center text-muted-foreground">
          <LogoIcon :size="56" class="mx-auto mb-4" />
          <p class="text-lg font-medium">Welcome to IO</p>
          <p class="text-sm mt-1">Send a message to get started.</p>
        </div>
      </div>

      <div
        v-for="msg in chat.messages"
        :key="msg.id"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] rounded-lg px-4 py-2 text-sm"
          :class="
            msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          "
        >
          <div v-if="msg.attachments.length > 0" class="mb-2 space-y-2">
            <div
              v-for="(attachment, idx) in msg.attachments"
              :key="`${msg.id}-${idx}`"
              class="rounded border border-border/50 p-2 bg-background/70 text-foreground"
            >
              <img
                v-if="isImageAttachment(attachment)"
                :src="toDataUrl(attachment)"
                :alt="attachment.name"
                class="max-h-44 rounded mb-1 object-contain"
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
            :class="msg.role === 'user' ? 'prose-invert' : ''"
          />
          <span v-else-if="!msg.streaming" class="text-muted-foreground">...</span>
          <div
            v-if="msg.streaming"
            class="inline-block w-2 h-4 bg-current animate-pulse ml-1"
          ></div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div
      class="border-t border-border p-4"
      :class="isDragging ? 'bg-accent/40' : ''"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileInput" />

      <div v-if="pendingAttachments.length > 0" class="mb-2 space-y-2">
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(attachment, idx) in pendingAttachments"
            :key="`${attachment.name}-${idx}`"
            class="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs bg-muted"
          >
            <ImageIcon v-if="isImageAttachment(attachment)" class="w-3.5 h-3.5" />
            <FileText v-else class="w-3.5 h-3.5" />
            <span class="max-w-[170px] truncate">{{ attachment.name }}</span>
            <span class="opacity-70">{{ formatAttachmentSize(attachment.size) }}</span>
            <button class="hover:text-destructive" @click="removeAttachment(idx)">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ formatAttachmentSize(totalPendingAttachmentBytes) }} attached · Max per file
          {{ formatAttachmentSize(MAX_ATTACHMENT_BYTES) }} · Max total
          {{ formatAttachmentSize(MAX_TOTAL_ATTACHMENT_BYTES) }}
        </p>
      </div>

      <p v-if="composerError" class="text-xs text-destructive mb-2">{{ composerError }}</p>

      <div class="flex gap-2 items-end">
        <button
          class="rounded-md border border-input p-2 hover:bg-accent disabled:opacity-50"
          :disabled="chat.isStreaming"
          @click="openPicker"
          title="Attach files"
        >
          <Paperclip class="w-4 h-4" />
        </button>
        <textarea
          ref="textareaRef"
          v-model="input"
          @keydown="handleKeydown"
          placeholder="Send a message..."
          rows="1"
          class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
        ></textarea>
        <button
          @click="send"
          :disabled="!canSend"
          class="rounded-md bg-primary text-primary-foreground p-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Send v-if="!chat.isStreaming" class="w-4 h-4" />
          <Square v-else class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
