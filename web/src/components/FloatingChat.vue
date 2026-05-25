<template>
  <!-- Overlay backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="isOpen = false">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true"></div>

      <!-- Chat panel -->
      <div class="relative w-full max-w-lg h-[70vh] max-h-[600px] flex flex-col rounded-2xl bg-bg-surface border border-border shadow-card overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span class="text-accent-cyan text-[9px] font-bold font-mono">IO</span>
            </div>
            <span class="text-sm font-semibold text-text">IO Chat</span>
          </div>
          <button
            @click="isOpen = false"
            class="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors duration-150"
            title="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
          </button>
        </div>

        <!-- Messages area -->
        <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <!-- Empty state -->
          <div v-if="store.messages.length === 0" class="flex flex-col items-center justify-center h-full select-none">
            <div class="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
              <span class="text-accent-cyan font-bold text-sm font-mono">IO</span>
            </div>
            <p class="text-text-muted text-xs">Send a message to start</p>
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
                class="max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm text-xs whitespace-pre-wrap bg-accent-cyan/[0.12] text-text border border-accent-cyan/20"
              >{{ msg.content }}</div>
              <div v-else class="max-w-[85%] flex gap-2 items-start">
                <div class="shrink-0 w-5 h-5 rounded-md bg-bg-elevated border border-border flex items-center justify-center mt-0.5">
                  <span class="text-accent-cyan text-[8px] font-bold font-mono">IO</span>
                </div>
                <div
                  class="floating-chat-md min-w-0 px-3 py-2 rounded-xl rounded-tl-sm text-xs bg-bg-card text-text border border-border"
                  v-html="renderMarkdown(msg.content) + (msg.streaming ? streamCursorHtml : '')"
                ></div>
              </div>
            </div>

            <!-- Thinking indicator -->
            <div v-if="store.isLoading && !isStreaming" class="flex justify-start">
              <div class="flex gap-2 items-start">
                <div class="shrink-0 w-5 h-5 rounded-md bg-bg-elevated border border-border flex items-center justify-center">
                  <span class="text-accent-cyan text-[8px] font-bold font-mono">IO</span>
                </div>
                <div class="px-3 py-2 rounded-xl rounded-tl-sm bg-bg-card border border-border flex items-center gap-1">
                  <span class="thinking-dot" style="animation-delay: 0s"></span>
                  <span class="thinking-dot" style="animation-delay: 0.15s"></span>
                  <span class="thinking-dot" style="animation-delay: 0.3s"></span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Input -->
        <div class="shrink-0 border-t border-border p-2.5 bg-bg-card">
          <form @submit.prevent="sendMessage" class="flex gap-2 items-end">
            <textarea
              ref="inputEl"
              v-model="input"
              placeholder="Message IO…"
              :disabled="store.isLoading"
              rows="1"
              class="flex-1 bg-bg-app border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted resize-none overflow-hidden focus:outline-none focus:border-accent-cyan/40 disabled:opacity-40 transition-all duration-150"
              @keydown="handleKeydown"
              @input="autoResize"
            />
            <button
              v-if="store.isLoading"
              type="button"
              @click="stopOrchestrator"
              class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent-red/15 text-accent-red border border-accent-red/25 hover:bg-accent-red/25 transition-all duration-150"
              title="Stop"
            >
              <span class="w-2 h-2 rounded-[2px] bg-accent-red"></span>
            </button>
            <button
              v-else
              type="submit"
              :disabled="!input.trim()"
              class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25 hover:bg-accent-cyan/25 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150"
              title="Send"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path d="M2.18 2.11a.5.5 0 0 1 .54-.06l15 7.5a.5.5 0 0 1 0 .9l-15 7.5a.5.5 0 0 1-.7-.58L3.98 10 2.02 2.63a.5.5 0 0 1 .16-.52Zm2.7 8.39-1.61 6.06L16.38 10 3.27 3.44 4.88 9.5h6.62a.5.5 0 1 1 0 1H4.88Z"/></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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

// Exposed so App.vue / CommandBar can control open state
function open() {
  isOpen.value = true
  hasUnread.value = false
  lastSeenCount.value = store.messages.length
  nextTick(() => scrollToBottom())
}

defineExpose({ open, isOpen, hasUnread })

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'instant' })
    }
  })
}

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

watch(
  () => store.messages[store.messages.length - 1]?.content,
  () => { if (isOpen.value) scrollToBottom() }
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
  nextTick(() => { if (inputEl.value) inputEl.value.style.height = 'auto' })
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
    } catch { /* ignore */ }
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
  background-color: #00d9ff;
  animation: thinking 1.4s ease-in-out infinite;
}

.floating-chat-md :deep(.stream-cursor) {
  display: inline-block;
  width: 2px;
  height: 0.9em;
  margin-left: 1px;
  background-color: #00d9ff;
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
  background: #0a0a0f;
  border-color: #252530;
  border-radius: 0.5rem;
}
.floating-chat-md :deep(code) { font-family: 'JetBrains Mono', monospace; }
.floating-chat-md :deep(a) { color: #00d9ff; }
.floating-chat-md :deep(a:hover) { text-decoration: underline; }
.floating-chat-md :deep(ol) { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
.floating-chat-md :deep(ul) { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
.floating-chat-md :deep(li) { margin: 0.25em 0; }
</style>
