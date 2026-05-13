<template>
  <div class="flex flex-col h-full relative">
    <!-- Message history -->
    <div ref="messagesEl" class="flex-1 overflow-y-auto p-6 space-y-4" @scroll="handleScroll">
      <div v-if="store.messages.length === 0" class="text-gray-600 text-sm text-center mt-12">
        Send a message to start chatting with IO
      </div>

      <div
        v-for="msg in store.messages"
        :key="msg.id"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] px-4 py-3 rounded-lg text-sm whitespace-pre-wrap"
          :class="
            msg.role === 'user'
              ? 'bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-100 border border-gray-700'
          "
        >
          <span>{{ msg.content }}</span>
          <span v-if="msg.streaming" class="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />
        </div>
      </div>

      <!-- Thinking indicator -->
      <div v-if="store.isLoading && !isStreaming" class="flex justify-start">
        <div class="bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-sm text-gray-400 flex gap-1">
          <span class="animate-bounce" style="animation-delay: 0ms">·</span>
          <span class="animate-bounce" style="animation-delay: 150ms">·</span>
          <span class="animate-bounce" style="animation-delay: 300ms">·</span>
        </div>
      </div>
    </div>

    <!-- Scroll to bottom button -->
    <button
      v-if="isScrolledUp"
      @click="scrollToBottom"
      class="absolute bottom-20 right-8 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full p-2 shadow-lg transition-all z-10"
      title="Scroll to bottom"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Input bar -->
    <div class="border-t border-gray-800 p-4">
      <form @submit.prevent="sendMessage" class="flex gap-3 items-end">
        <textarea
          ref="inputEl"
          v-model="input"
          placeholder="Message IO..."
          :disabled="store.isLoading"
          rows="1"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden"
          @keydown="handleKeydown"
          @input="autoResize"
        />
        <button
          v-if="store.isLoading"
          type="button"
          @click="stopOrchestrator"
          :disabled="stopping"
          class="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          title="Stop the orchestrator"
        >
          <span class="inline-block w-3 h-3 bg-white rounded-sm"></span>
          {{ stopping ? 'Stopping...' : 'Stop' }}
        </button>
        <button
          v-else
          type="submit"
          :disabled="!input.trim()"
          class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { apiFetch, authenticatedUrl } from '../lib/api'

const store = useChatStore()
const input = ref('')
const stopping = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const isScrolledUp = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)

async function stopOrchestrator() {
  if (stopping.value) return
  stopping.value = true
  try {
    await apiFetch('/api/orchestrator/abort', { method: 'POST' })
  } catch {
    // best-effort — UI will recover when SSE delivers done/error
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
  // Consider "at bottom" if within 100px of the end
  isScrolledUp.value = el.scrollTop + el.clientHeight < el.scrollHeight - 100
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

// Only auto-scroll on incoming messages when user hasn't scrolled up
watch(() => store.messages.length, () => {
  if (!isScrolledUp.value) scrollToBottom()
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
  // Shift+Enter falls through and inserts a newline
}

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px' // max ~8 lines
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

  // Always scroll when user sends — they want to see the response
  scrollToBottom()

  // Open SSE stream for real-time deltas
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

  // Send message — response includes full text but SSE deltas are primary UX
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
