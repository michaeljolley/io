<template>
  <Teleport to="body">
    <Transition name="chat-overlay">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" @keydown.escape.self="close">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>
        <div class="relative w-full max-w-2xl h-[70vh] sm:h-[600px] bg-bg-surface border border-border rounded-xl flex flex-col overflow-hidden animate-fade-in">
          <div class="h-11 shrink-0 border-b border-border flex items-center justify-between px-4">
            <div class="flex items-center gap-2">
              <span class="text-accent-cyan font-mono font-bold text-sm">IO</span>
              <span class="w-px h-3 bg-border"></span>
              <span class="text-text-muted text-xs">Chat</span>
            </div>
            <button @click="close" class="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
            </button>
          </div>
          <div ref="messagesEl" class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-if="!store.messages.length" class="h-full flex flex-col items-center justify-center text-text-muted gap-2">
              <span class="text-2xl font-mono font-bold text-accent-cyan/30">IO</span>
              <p class="text-xs">Ask me anything...</p>
            </div>
            <div v-for="msg in store.messages" :key="msg.id" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div :class="['max-w-[80%] rounded-lg px-3 py-2', msg.role === 'user' ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-text text-sm' : 'chat-markdown bg-bg-card border border-border text-text-secondary font-mono text-xs leading-relaxed']">
                <div v-if="msg.role === 'assistant'" class="wiki-content" v-html="renderMarkdown(msg.content) + (msg.streaming ? streamCursorHtml : '')"></div>
                <template v-else>
                  <span class="whitespace-pre-wrap">{{ msg.content }}</span>
                  <div v-if="msg.attachments?.length" class="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-current/10">
                    <span v-for="att in msg.attachments" :key="att.displayName ?? att.mimeType" class="inline-flex items-center gap-1 text-[10px] bg-black/20 rounded px-1.5 py-0.5">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd"/></svg>
                      {{ att.displayName ?? att.mimeType }}
                    </span>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="store.isLoading && !isStreaming" class="flex justify-start"><div class="bg-bg-card border border-border rounded-lg px-3 py-2"><span class="flex gap-1"><span class="thinking-dot"></span><span class="thinking-dot" style="animation-delay:0.15s"></span><span class="thinking-dot" style="animation-delay:0.3s"></span></span></div></div>
          </div>
          <div class="shrink-0 border-t border-border p-3">
            <form class="flex items-end gap-2" @submit.prevent="sendMessage">
              <textarea ref="inputEl" v-model="input" @keydown="handleKeydown" @input="autoResize" :disabled="store.isLoading" placeholder="Type a message..." rows="1" class="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none resize-none transition-colors leading-relaxed" style="min-height: 40px; max-height: 100px; overflow-y: auto;"></textarea>
              <button v-if="store.isLoading" type="button" @click="stopOrchestrator" class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors"><span class="w-2.5 h-2.5 rounded-[2px] bg-current"></span></button>
              <button v-else type="submit" :disabled="!input.trim()" class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3.105 3.71a.75.75 0 0 1 .855-.163l13 6.5a.75.75 0 0 1 0 1.342l-13 6.5a.75.75 0 0 1-1.036-.86L5.25 10l-2.326-6.29a.75.75 0 0 1 .18-.8Z"/></svg></button>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

function close() {
  isOpen.value = false
}

defineExpose({ open, isOpen })

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
.chat-overlay-enter-active, .chat-overlay-leave-active { transition: opacity 0.2s; }
.chat-overlay-enter-from, .chat-overlay-leave-to { opacity: 0; }
@keyframes thinking { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
.thinking-dot { display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: #00d9ff; animation: thinking 1.4s ease-in-out infinite; }
.chat-markdown :deep(.stream-cursor) { display: inline-block; width: 2px; height: 0.9em; margin-left: 1px; background: #00d9ff; vertical-align: text-bottom; animation: cursor-blink 0.8s steps(2) infinite; }
@keyframes cursor-blink { 0% { opacity: 1; } 50% { opacity: 0; } }
.chat-markdown :deep(p) { margin: 0.1rem 0; }
.chat-markdown :deep(pre) { font-size: 0.7rem; }
.chat-markdown :deep(code) { font-family: 'JetBrains Mono', monospace; }
</style>
