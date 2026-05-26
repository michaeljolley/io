<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { renderMarkdown } from '@/lib/markdown'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const prompt = ref('')
const scrollPanel = ref<HTMLElement | null>(null)

const suggestions = [
  'Summarize current squad health',
  'List unread feed items that need action',
  'What schedules should I watch today?',
  'Show recent MCP changes',
]

const displayMessages = computed(() => {
  if (chat.messages.length) return chat.messages
  return [{
    id: 'welcome',
    role: 'assistant',
    text: 'IO online. What do you need?',
    createdAt: new Date().toISOString(),
    streaming: false,
  }]
})

const signature = computed(() => displayMessages.value.map((message) => `${message.id}:${message.text.length}:${message.streaming}`).join('|'))

function scrollToBottom() {
  if (scrollPanel.value) {
    scrollPanel.value.scrollTop = scrollPanel.value.scrollHeight
  }
}

async function send() {
  const value = prompt.value.trim()
  if (!value) return
  prompt.value = ''
  await chat.sendMessage(value)
}

async function applySuggestion(text: string) {
  prompt.value = text
  await nextTick()
}

watch(signature, async () => {
  await nextTick()
  scrollToBottom()
})
</script>

<template>
  <div class="h-full overflow-y-auto p-3 md:p-5">
    <section class="mx-auto flex h-full max-w-[980px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Command Console</div>
          <div class="mt-2 text-sm text-foreground/80">Direct operator channel into the orchestrator stream.</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" @click="chat.clearMessages()">clear</button>
          <button class="rounded border border-destructive/40 px-3 py-1.5 font-mono text-xs text-destructive transition-colors hover:bg-destructive/10" :disabled="!chat.isLoading" @click="chat.abortRun()">abort</button>
        </div>
      </div>

      <div ref="scrollPanel" class="flex-1 overflow-y-auto px-5 py-5">
        <div v-if="!chat.messages.length" class="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <pre class="font-mono text-xs leading-5 text-primary">╔════════════════════════════════════╗
║   IO // MISSION CONTROL CONSOLE   ║
║  route prompts, inspect streams   ║
╚════════════════════════════════════╝</pre>
          <div class="mt-4 flex flex-wrap gap-2">
            <button v-for="suggestion in suggestions" :key="suggestion" class="rounded-full border border-border bg-sidebar px-3 py-1.5 font-mono text-xs text-foreground/75 transition-colors hover:border-primary/40 hover:text-primary" @click="applySuggestion(suggestion)">
              {{ suggestion }}
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <article v-for="message in displayMessages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[82%] rounded-lg border px-4 py-3" :class="message.role === 'user' ? 'rounded-br-sm border-primary/20 bg-primary/15 font-mono text-primary' : 'rounded-bl-sm border-white/[0.06] bg-white/[0.04] text-foreground/75'">
              <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.2em]" :class="message.role === 'user' ? 'text-primary' : 'text-muted-foreground/60'">{{ message.role }}</div>
              <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm leading-relaxed">{{ message.text }}</div>
              <div v-else class="wiki-content text-sm" v-html="renderMarkdown(message.text || (message.streaming ? '…' : ''))" />
              <div v-if="message.streaming" class="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/70">streaming…</div>
            </div>
          </article>
        </div>
      </div>

      <form class="shrink-0 border-t border-border px-5 py-4" @submit.prevent="send">
        <textarea v-model="prompt" rows="4" class="w-full rounded-lg border border-border bg-sidebar px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40" placeholder="Type a prompt for IO. Ctrl+Enter sends." @keydown.ctrl.enter.prevent="send" />
        <div class="mt-3 flex items-center justify-between gap-3">
          <div class="font-mono text-[11px] text-muted-foreground/55">Ctrl+. opens the floating command bar.</div>
          <button type="submit" class="flex items-center gap-1 rounded bg-primary/15 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:bg-primary/25">
            <AppIcon name="zap" class="h-3 w-3" />
            dispatch
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
