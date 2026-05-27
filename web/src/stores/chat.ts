import { defineStore } from "pinia";
import { ref } from "vue";
import { apiPost } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const eventSource = ref<EventSource | null>(null);
  const conversationId = ref<string>(crypto.randomUUID());

  function addUserMessage(content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    messages.value.push(msg);
    return msg;
  }

  async function sendMessage(content: string): Promise<void> {
    addUserMessage(content);
    isStreaming.value = true;

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };
    messages.value.push(assistantMsg);

    try {
      const response = await apiPost("/message", {
        prompt: content,
        conversationId: conversationId.value,
      });
      assistantMsg.content = response.content;
      assistantMsg.streaming = false;
      // Server may echo back the conversationId (e.g. when it was generated server-side)
      if (response.conversationId) {
        conversationId.value = response.conversationId;
      }
    } catch (err: any) {
      assistantMsg.content = `Error: ${err.message}`;
      assistantMsg.streaming = false;
    } finally {
      isStreaming.value = false;
    }
  }

  function updateStreamingMessage(content: string): void {
    const last = messages.value[messages.value.length - 1];
    if (last?.streaming) {
      last.content = content;
    }
  }

  function clearMessages(): void {
    messages.value = [];
    conversationId.value = crypto.randomUUID();
  }

  return {
    messages,
    isStreaming,
    eventSource,
    conversationId,
    sendMessage,
    updateStreamingMessage,
    clearMessages,
  };
});
