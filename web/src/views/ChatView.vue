<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
import { useChatStore } from "@/stores/chat";
import { Send, Square } from "lucide-vue-next";

const chat = useChatStore();
const input = ref("");
const messagesContainer = ref<HTMLElement>();

async function send() {
  const text = input.value.trim();
  if (!text || chat.isStreaming) return;
  input.value = "";
  await chat.sendMessage(text);
  await nextTick();
  scrollToBottom();
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

onMounted(() => scrollToBottom());
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="chat.messages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center text-muted-foreground">
          <div class="text-4xl mb-3">🤖</div>
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
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          "
        >
          <div class="whitespace-pre-wrap break-words" v-html="msg.content || '...'"></div>
          <div
            v-if="msg.streaming"
            class="inline-block w-2 h-4 bg-current animate-pulse ml-1"
          ></div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-border p-4">
      <div class="flex gap-2 items-end">
        <textarea
          v-model="input"
          @keydown="handleKeydown"
          placeholder="Send a message..."
          rows="1"
          class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
        ></textarea>
        <button
          @click="send"
          :disabled="!input.trim() || chat.isStreaming"
          class="rounded-md bg-primary text-primary-foreground p-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Send v-if="!chat.isStreaming" class="w-4 h-4" />
          <Square v-else class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
