import { defineStore } from "pinia";
import { ref } from "vue";
import type { MessageAttachment } from "@/lib/attachments";
import { useAuthStore } from "./auth";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: MessageAttachment[];
  timestamp: Date;
  streaming?: boolean;
}

// Time threshold (ms) — if more than this has elapsed since the last delta
// AND the previous assistant message was finalized, start a new bubble.
const NEW_BUBBLE_THRESHOLD = 5_000;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const eventSource = ref<EventSource | null>(null);
  const conversationId = ref<string>(crypto.randomUUID());
  const currentAbortController = ref<AbortController | null>(null);

  function addUserMessage(content: string, attachments: MessageAttachment[] = []): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      attachments,
      timestamp: new Date(),
    };
    messages.value.push(msg);
    return msg;
  }

  async function sendMessage(
    content: string,
    attachments: MessageAttachment[] = []
  ): Promise<void> {
    addUserMessage(content, attachments);
    isStreaming.value = true;

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      attachments: [],
      timestamp: new Date(),
      streaming: true,
    };
    messages.value.push(assistantMsg);

    let lastDeltaTime = Date.now();

    try {
      const auth = useAuthStore();
      // Proactively refresh if token is near expiry
      if (auth.token && isTokenExpired(auth.token)) {
        await auth.refreshToken();
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }

      currentAbortController.value = new AbortController();

      const response = await fetch("/api/message", {
        method: "POST",
        headers,
        signal: currentAbortController.value.signal,
        body: JSON.stringify({
          prompt: content,
          conversationId: conversationId.value,
          attachments,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status}`);
      }

      // Read SSE stream from response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (currentEvent === "delta") {
                const now = Date.now();
                // Smart bubble: if enough time passed and last message was finalized,
                // create a new assistant bubble
                const lastMsg = messages.value[messages.value.length - 1];
                if (
                  lastMsg &&
                  !lastMsg.streaming &&
                  lastMsg.role === "assistant" &&
                  now - lastDeltaTime > NEW_BUBBLE_THRESHOLD
                ) {
                  const newMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: parsed.content,
                    attachments: [],
                    timestamp: new Date(),
                    streaming: true,
                  };
                  messages.value.push(newMsg);
                } else {
                  // Find the current streaming bubble and update it
                  const streaming = messages.value.filter((m) => m.streaming);
                  const target = streaming[streaming.length - 1];
                  if (target) {
                    target.content = parsed.content;
                  }
                }
                lastDeltaTime = now;
              } else if (currentEvent === "done") {
                // Finalize the streaming bubble
                const streaming = messages.value.filter((m) => m.streaming);
                const target = streaming[streaming.length - 1];
                if (target) {
                  target.content = parsed.content;
                  target.streaming = false;
                }
                if (parsed.conversationId) {
                  conversationId.value = parsed.conversationId;
                }
              } else if (currentEvent === "error") {
                const streaming = messages.value.filter((m) => m.streaming);
                const target = streaming[streaming.length - 1];
                if (target) {
                  target.content = `Error: ${parsed.error}`;
                  target.streaming = false;
                }
              }
            } catch {
              // Ignore malformed JSON lines
            }
            currentEvent = "";
          } else if (line.startsWith(":")) {
            // Comment (keepalive) — ignore
          }
        }
      }
    } catch (err: any) {
      // Finalize any streaming bubble with the error
      const streaming = messages.value.filter((m) => m.streaming);
      const target = streaming[streaming.length - 1];
      if (target) {
        if (err?.name === "AbortError") {
          target.streaming = false;
        } else {
          target.content = `Error: ${err.message}`;
          target.streaming = false;
        }
      }
    } finally {
      currentAbortController.value = null;
      isStreaming.value = false;
    }
  }

  function stopStreaming(): void {
    currentAbortController.value?.abort();
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
    stopStreaming,
  };
});
