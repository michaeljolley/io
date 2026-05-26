<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { renderMarkdown } from '@/lib/markdown'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const prompt = ref('')
const isOpen = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const scrollPanel = ref<HTMLElement | null>(null)

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

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

watch(isOpen, async (value) => {
  if (!value) return
  await nextTick()
  inputRef.value?.focus()
  scrollToBottom()
})

watch(signature, async () => {
  if (!isOpen.value) return
  await nextTick()
  scrollToBottom()
})

defineExpose({ open, isOpen })
</script>

<template>
  <div class="fixed bottom-0 right-0 z-50 flex w-full flex-col md:bottom-4 md:right-4 md:w-[360px]">
    <transition enter-active-class="duration-200 ease-out" enter-from-class="translate-y-2 scale-[0.97] opacity-0" enter-to-class="translate-y-0 scale-100 opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="translate-y-0 scale-100 opacity-100" leave-to-class="translate-y-2 scale-[0.97] opacity-0">
      <div v-if="isOpen" class="flex h-[380px] flex-col overflow-hidden rounded-t-xl border border-border border-b-0 bg-sidebar">
        <div class="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2.5">
          <div class="flex items-center gap-2">
            <AppIcon name="terminal" class="h-3.5 w-3.5 text-primary" />
            <span class="font-mono text-xs text-foreground/70">IO Command</span>
          </div>
          <button class="text-muted-foreground/40 transition-colors hover:text-muted-foreground" @click="close">
            <AppIcon name="chevron-down" class="h-4 w-4" />
          </button>
        </div>

        <div ref="scrollPanel" class="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          <div v-for="message in displayMessages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed" :class="message.role === 'user' ? 'rounded-br-sm border border-primary/20 bg-primary/15 font-mono text-primary' : 'rounded-bl-sm border border-white/[0.06] bg-white/[0.04] text-foreground/75'">
              <div v-if="message.role === 'user'" class="whitespace-pre-wrap">{{ message.text }}</div>
              <div v-else class="wiki-content text-xs" v-html="renderMarkdown(message.text || (message.streaming ? '…' : ''))" />
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div class="overflow-hidden border border-border bg-sidebar" :class="isOpen ? 'rounded-b-xl border-t-0' : 'rounded-xl'">
      <form v-if="isOpen" class="flex items-center gap-2 border-t border-border/50 px-3 py-2.5" @submit.prevent="send">
        <input
          ref="inputRef"
          v-model="prompt"
          type="text"
          placeholder="Command IO..."
          class="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/40"
        />
        <button type="submit" class="flex shrink-0 items-center gap-1 rounded bg-primary/15 px-2.5 py-1 font-mono text-xs text-primary transition-colors hover:bg-primary/25">
          <AppIcon name="zap" class="h-3 w-3" />
          send
        </button>
      </form>
      <button v-else class="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]" @click="open">
        <AppIcon name="terminal" class="h-4 w-4 text-primary" style="filter: drop-shadow(0 0 6px #00d9ff88)" />
        <span class="flex-1 font-mono text-sm text-muted-foreground/60">Command IO...</span>
        <AppIcon name="chevron-up" class="h-4 w-4 text-muted-foreground/30" />
      </button>
    </div>
  </div>
</template>
