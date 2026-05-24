<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col items-end">
    <!-- Expanded panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-90 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-90 translate-y-4"
    >
      <div
        v-if="isOpen"
        class="mb-3 w-[400px] h-[500px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-surface-2 border border-edge shadow-card overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-edge/50 bg-surface-3/50">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span class="text-accent text-[9px] font-bold font-mono">IO</span>
            </div>
            <span class="text-xs font-semibold text-txt-primary">Chat</span>
          </div>
          <button
            @click="isOpen = false"
            class="p-1 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-surface-2 transition-all duration-150"
            title="Minimize"
          >
            <FluentIcon :paths='`<path d="M3.5 10a.5.5 0 0 0 0 1h13a.5.5 0 0 0 0-1h-13Z"/>`' :size="14" />
          </button>
        </div>

        <!-- Messages area -->
        <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <!-- Empty state -->
          <div v-if="store.messages.length === 0" class="flex flex-col items-center justify-center h-full select-none">
            <div class="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
              <span class="text-accent font-bold text-sm font-mono">IO</span>
            </div>
            <p class="text-txt-muted text-xs">Send a message to start</p>
          </div>

          <!-- Messages -->
          <template v-else>
            <div
              v-for="msg in store.messages"
              :key="msg.id"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                v-if="msg.role === 'user'"
                class="max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm text-xs whitespace-pre-wrap bg-accent/[0.12] text-txt-primary border border-accent/20"
              >{{ msg.content }}</div>
              <div v-else class="max-w-[85%] flex gap-2 items-start">
                <div class="shrink-0 w-5 h-5 rounded-md bg-surface-3/60 border border-edge flex items-center justify-center mt-0.5">
                  <span class="text-accent text-[8px] font-bold font-mono">IO</span>
                </div>
                <div
                  class="floating-chat-md min-w-0 px-3 py-2 rounded-xl rounded-tl-sm text-xs bg-surface-0/60 text-txt-primary border border-edge/50"
                  v-html="renderMarkdown(msg.content) + (msg.streaming ? streamCursorHtml : '')"
                ></div>
              </div>
            </div>

            <!-- Thinking indicator -->
            <div v-if="store.isLoading && !isStreaming" class="flex justify-start">
              <div class="flex gap-2 items-start">
                <div class="shrink-0 w-5 h-5 rounded-md bg-surface-3/60 border border-edge flex items-center justify-center">
                  <span class="text-accent text-[8px] font-bold font-mono">IO</span>
                </div>
                <div class="px-3 py-2 rounded-xl rounded-tl-sm bg-surface-0/60 border border-edge/50 flex items-center gap-1">
                  <span class="thinking-dot" style="animation-delay: 0s"></span>
                  <span class="thinking-dot" style="animation-delay: 0.15s"></span>
                  <span class="thinking-dot" style="animation-delay: 0.3s"></span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Input -->
        <div class="shrink-0 border-t border-edge/50 p-2.5 bg-surface-3/30">
          <form @submit.prevent="sendMessage" class="flex gap-2 items-end">
            <textarea
              ref="inputEl"
              v-model="input"
              placeholder="Message IO…"
              :disabled="store.isLoading"
              rows="1"
              class="flex-1 bg-surface-0/50 border border-edge rounded-lg px-3 py-2 text-xs text-txt-primary placeholder:text-txt-muted/60 resize-none overflow-hidden focus:outline-none focus:border-accent/40 disabled:opacity-40 transition-all duration-150"
              @keydown="handleKeydown"
              @input="autoResize"
            />
            <button
              v-if="store.isLoading"
              type="button"
              @click="stopOrchestrator"
              class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all duration-150"
              title="Stop"
            >
              <span class="w-2 h-2 rounded-[2px] bg-red-400"></span>
            </button>
            <button
              v-else
              type="submit"
              :disabled="!input.trim()"
              class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150"
              title="Send"
            >
              <FluentIcon :paths='`<path d="M2.18 2.11a.5.5 0 0 1 .54-.06l15 7.5a.5.5 0 0 1 0 .9l-15 7.5a.5.5 0 0 1-.7-.58L3.98 10 2.02 2.63a.5.5 0 0 1 .16-.52Zm2.7 8.39-1.61 6.06L16.38 10 3.27 3.44 4.88 9.5h6.62a.5.5 0 1 1 0 1H4.88Z"/>`' :size="14" />
            </button>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Collapsed: floating bubble -->
    <button
      v-if="!isOpen"
      @click="openChat"
      class="w-12 h-12 rounded-full bg-accent/15 border border-accent/25 text-accent flex items-center justify-center shadow-glow-sm hover:bg-accent/25 hover:border-accent/40 hover:shadow-glow transition-all duration-200 relative"
      title="Open chat"
    >
      <FluentIcon :paths='`<path d="M10 2a8 8 0 1 1-3.61 15.14l-3.05.92a.75.75 0 0 1-.92-.93l.94-3.05A8 8 0 0 1 10 2Zm0 1a7 7 0 0 0-5.87 10.77.75.75 0 0 1 .07.56l-.72 2.34 2.32-.7a.75.75 0 0 1 .57.07A7 7 0 1 0 10 3Z"/>`' :size="22" />
      <!-- Unread dot -->
      <span
        v-if="hasUnread"
        class="absolute top-0 right-0 w-3 h-3 rounded-full bg-accent border-2 border-surface-2 shadow-glow-sm"
      ></span>
      <!-- Activity pulse ring (visible when IO is thinking) -->
      <span
        v-if="store.isLoading"
        class="absolute inset-0 rounded-full border-2 border-accent/60 animate-ping pointer-events-none"
      ></span>
      <span
        v-if="store.isLoading"
        class="absolute inset-0 rounded-full border border-accent/30 animate-pulse pointer-events-none"
      ></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import FluentIcon from './FluentIcon.vue'
import { useChatStore } from '../stores/chat'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch, authenticatedUrl } from '../lib/api'

const store = useChatStore()
const isOpen = ref(false)
const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const hasUnread = ref(false)
const lastSeenCount = ref(store.messages.length)

const streamCursorHtml = '<span class="stream-cursor"></span>'

const isStreaming = computed(() =>
  store.messages.some((m) => m.streaming)
)

function openChat() {
  isOpen.value = true
  hasUnread.value = false
  lastSeenCount.value = store.messages.length
  nextTick(() => scrollToBottom())
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'instant' })
    }
  })
}

// Auto-scroll on new messages when open; only mark unread for new assistant messages
watch(() => store.messages.length, (newLen) => {
  if (isOpen.value) {
    scrollToBottom()
    lastSeenCount.value = newLen
  } else {
    const lastMsg = store.messages[newLen - 1]
    if (newLen > lastSeenCount.value && lastMsg?.role === 'assistant') {
      hasUnread.value = true
    }
  }
})

// Also scroll when streaming appends content
watch(
  () => store.messages[store.messages.length - 1]?.content,
  () => {
    if (isOpen.value) scrollToBottom()
  }
)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

async function stopOrchestrator() {
  try {
    await apiFetch('/api/orchestrator/abort', { method: 'POST' })
  } catch { /* best-effort */ }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || store.isLoading) return

  input.value = ''
  nextTick(() => {
    if (inputEl.value) inputEl.value.style.height = 'auto'
  })
  store.isLoading = true

  store.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
  store.addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true })

  scrollToBottom()

  const evtSource = new EventSource(await authenticatedUrl('/api/events'))
  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as { type: 'delta' | 'done'; text: string }
      if (data.type === 'delta') {
        store.appendToLast(data.text)
      } else if (data.type === 'done') {
        store.setLastStreaming(false)
        store.isLoading = false
        evtSource.close()
      }
    } catch { /* ignore parse errors */ }
  }
  evtSource.onerror = () => {
    store.setLastStreaming(false)
    store.isLoading = false
    evtSource.close()
  }

  try {
    await apiFetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    store.appendToLast('\n\n[Error: failed to reach IO]')
    store.setLastStreaming(false)
    store.isLoading = false
    evtSource.close()
  }
}
</script>

<style scoped>
@keyframes thinking {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}
.thinking-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #22d3ee;
  animation: thinking 1.4s ease-in-out infinite;
}

.floating-chat-md :deep(.stream-cursor) {
  display: inline-block;
  width: 2px;
  height: 0.9em;
  margin-left: 1px;
  background-color: #22d3ee;
  vertical-align: text-bottom;
  animation: cursor-blink 0.8s steps(2) infinite;
}
@keyframes cursor-blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

.floating-chat-md :deep(p) { margin: 0.1rem 0; }
.floating-chat-md :deep(pre) {
  font-size: 0.65rem;
  background: #060a13;
  border-color: #1e2d4a;
  border-radius: 0.5rem;
}
.floating-chat-md :deep(code) { font-family: 'JetBrains Mono', monospace; }
.floating-chat-md :deep(a) { color: #22d3ee; }
.floating-chat-md :deep(a:hover) { text-decoration: underline; }
</style>
