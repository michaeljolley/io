<template>
  <div class="flex flex-col h-full relative bg-surface-0">
    <!-- Message history -->
    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6" @scroll="handleScroll">

      <!-- Empty state -->
      <div v-if="store.messages.length === 0" class="flex flex-col items-center justify-center h-full select-none animate-fade-in">
        <div class="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5 shadow-glow">
          <span class="text-accent font-bold text-2xl font-mono tracking-tighter">IO</span>
        </div>
        <p class="text-txt-secondary text-sm font-medium mb-1">What can I help you build?</p>
        <p class="text-txt-muted text-xs">Send a message to start a conversation</p>

        <div class="flex flex-wrap justify-center gap-2 mt-8 max-w-md">
          <button
            v-for="hint in suggestions"
            :key="hint"
            @click="useSuggestion(hint)"
            class="px-3 py-1.5 text-xs text-txt-secondary bg-surface-2/60 border border-edge rounded-full
                   hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all duration-200"
          >
            {{ hint }}
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div v-else class="max-w-3xl mx-auto space-y-5">
        <div
          v-for="msg in store.messages"
          :key="msg.id"
          class="flex animate-fade-in"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- User message -->
          <div
            v-if="msg.role === 'user'"
            class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm whitespace-pre-wrap
                   bg-gradient-to-br from-accent/[0.14] to-accent/[0.08] text-txt-primary border border-accent/20 shadow-glow-sm"
          >{{ msg.content }}</div>

          <!-- Assistant message -->
          <div v-else class="max-w-[85%] flex gap-2.5 items-start">
            <div class="shrink-0 w-6 h-6 rounded-lg bg-surface-3/60 border border-edge flex items-center justify-center mt-0.5">
              <span class="text-accent text-[10px] font-bold font-mono">IO</span>
            </div>
            <div
              class="chat-md min-w-0 px-4 py-2.5 rounded-2xl rounded-tl-md text-sm
                     bg-surface-2/70 text-txt-primary border border-edge"
              v-html="renderMarkdown(msg.content) + (msg.streaming ? streamCursorHtml : '')"
            ></div>
          </div>
        </div>

        <!-- Thinking indicator -->
        <div v-if="store.isLoading && !isStreaming" class="flex justify-start animate-fade-in">
          <div class="flex gap-2.5 items-start">
            <div class="shrink-0 w-6 h-6 rounded-lg bg-surface-3/60 border border-edge flex items-center justify-center">
              <span class="text-accent text-[10px] font-bold font-mono">IO</span>
            </div>
            <div class="px-4 py-3 rounded-2xl rounded-tl-md bg-surface-2/70 border border-edge flex items-center gap-1">
              <span class="thinking-dot" style="animation-delay: 0s"></span>
              <span class="thinking-dot" style="animation-delay: 0.15s"></span>
              <span class="thinking-dot" style="animation-delay: 0.3s"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll to bottom -->
    <Transition name="scroll-btn">
      <button
        v-if="isScrolledUp"
        @click="scrollToBottom"
        class="absolute bottom-24 left-1/2 -translate-x-1/2 z-10
               w-8 h-8 rounded-full bg-surface-2/90 backdrop-blur-sm border border-edge-bright
               text-txt-secondary hover:text-accent hover:border-accent/40 hover:shadow-glow-sm
               flex items-center justify-center transition-all duration-200"
        title="Scroll to bottom"
      >
        <FluentIcon :paths='`<path d="M15.85 7.65c.2.2.2.5 0 .7l-5.46 5.49a.55.55 0 0 1-.78 0L4.15 8.35a.5.5 0 1 1 .7-.7L10 12.8l5.15-5.16c.2-.2.5-.2.7 0Z"/>`' :size="16" />
      </button>
    </Transition>

    <!-- Input bar -->
    <div class="shrink-0 border-t border-edge/50 backdrop-blur-md p-3 sm:p-4" style="background: linear-gradient(180deg, rgba(12,18,32,0.75) 0%, rgba(8,13,22,0.88) 100%)">
      <form @submit.prevent="sendMessage" class="max-w-3xl mx-auto flex gap-2 items-end">
        <div class="flex-1 relative group">
          <textarea
            ref="inputEl"
            v-model="input"
            placeholder="Message IO…"
            :disabled="store.isLoading"
            rows="1"
            class="w-full bg-surface-2/60 border border-edge rounded-xl px-4 py-2.5 pr-3 text-sm text-txt-primary
                   placeholder-txt-muted/60 resize-none overflow-hidden
                   focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                   disabled:opacity-40 transition-all duration-200"
            @keydown="handleKeydown"
            @input="autoResize"
          />
        </div>
        <button
          v-if="store.isLoading"
          type="button"
          @click="stopOrchestrator"
          :disabled="stopping"
          class="shrink-0 h-10 px-3.5 rounded-xl text-sm font-medium
                 bg-red-500/15 text-red-400 border border-red-500/25
                 hover:bg-red-500/25 hover:border-red-500/40
                 disabled:opacity-40 disabled:cursor-not-allowed
                 transition-all duration-150 flex items-center gap-1.5"
          title="Stop"
        >
          <span class="w-2.5 h-2.5 rounded-[3px] bg-red-400"></span>
          <span class="hidden sm:inline">{{ stopping ? 'Stopping…' : 'Stop' }}</span>
        </button>
        <button
          v-else
          type="submit"
          :disabled="!input.trim()"
          class="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                 bg-accent/15 text-accent border border-accent/25
                 hover:bg-accent/25 hover:border-accent/40 hover:shadow-glow-sm
                 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:shadow-none
                 transition-all duration-150"
          title="Send"
        >
          <FluentIcon :paths='`<path d="M2.18 2.11a.5.5 0 0 1 .54-.06l15 7.5a.5.5 0 0 1 0 .9l-15 7.5a.5.5 0 0 1-.7-.58L3.98 10 2.02 2.63a.5.5 0 0 1 .16-.52Zm2.7 8.39-1.61 6.06L16.38 10 3.27 3.44 4.88 9.5h6.62a.5.5 0 1 1 0 1H4.88Z"/>`' :size="16" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import FluentIcon from '../components/FluentIcon.vue'
import { useChatStore } from '../stores/chat'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch, authenticatedUrl } from '../lib/api'

const store = useChatStore()
const route = useRoute()
const input = ref('')
const stopping = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const isScrolledUp = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const streamCursorHtml = '<span class="stream-cursor"></span>'

const suggestions = [
  'Check squad status',
  'Run my schedules',
  'Summarize recent activity',
  'What skills are installed?',
]

function useSuggestion(text: string) {
  input.value = text
  nextTick(() => sendMessage())
}

async function stopOrchestrator() {
  if (stopping.value) return
  stopping.value = true
  try {
    await apiFetch('/api/orchestrator/abort', { method: 'POST' })
  } catch {
    // best-effort
  } finally {
    stopping.value = false
  }
}

const isStreaming = computed(() =>
  store.messages.some((m) => m.streaming)
)

function handleScroll() {
  const el = messagesEl.value
  if (!el) return
  isScrolledUp.value = el.scrollTop + el.clientHeight < el.scrollHeight - 100
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTo({ top: messagesEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
    }
  })
}

onMounted(() => {
  scrollToBottom(false)
})

// Scroll to bottom when navigating back to the chat tab
watch(() => route.name, (name) => {
  if (name === 'chat') scrollToBottom(false)
})

watch(() => store.messages.length, () => {
  if (!isScrolledUp.value) scrollToBottom()
})

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
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || store.isLoading) return

  input.value = ''
  nextTick(() => {
    if (inputEl.value) {
      inputEl.value.style.height = 'auto'
    }
  })
  store.isLoading = true

  store.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
  store.addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true })

  scrollToBottom()

  const evtSource = new EventSource(authenticatedUrl('/api/events'))
  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as { type: 'delta' | 'done'; text: string }
      if (data.type === 'delta') {
        store.appendToLast(data.text)
        scrollToBottom()
      } else if (data.type === 'done') {
        store.setLastStreaming(false)
        store.isLoading = false
        evtSource.close()
        scrollToBottom()
      }
    } catch {
      // ignore parse errors
    }
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
/* ── Thinking dots ── */
@keyframes thinking {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}
.thinking-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #22d3ee; /* accent */
  animation: thinking 1.4s ease-in-out infinite;
}

/* ── Streaming cursor ── */
.chat-md :deep(.stream-cursor) {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background-color: #22d3ee;
  vertical-align: text-bottom;
  animation: cursor-blink 0.8s steps(2) infinite;
}
@keyframes cursor-blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

/* ── Chat markdown overrides (compact for bubbles) ── */
.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4) {
  line-height: 1.3;
}
.chat-md :deep(p) {
  margin: 0.15rem 0;
}
.chat-md :deep(ul),
.chat-md :deep(ol) {
  padding-left: 0.5rem;
}
.chat-md :deep(pre) {
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  background: #060a13; /* surface-0 */
  border-color: #1e2d4a; /* edge */
  border-radius: 0.625rem;
}
.chat-md :deep(code) {
  font-family: 'JetBrains Mono', monospace;
}
.chat-md :deep(table) {
  font-size: 0.75rem;
}
.chat-md :deep(a) {
  color: #22d3ee; /* accent */
}
.chat-md :deep(a:hover) {
  text-decoration: underline;
}

/* ── Scroll button transition ── */
.scroll-btn-enter-active { transition: all 0.2s ease-out; }
.scroll-btn-leave-active { transition: all 0.15s ease-in; }
.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
