<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { renderMarkdown } from '@/lib/markdown'

const chat = useChatStore()
const prompt = ref('')
const isOpen = ref(false)
const textarea = ref<HTMLTextAreaElement | null>(null)

async function send() {
  if (!prompt.value.trim()) return
  const value = prompt.value
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
  if (value) {
    await nextTick()
    textarea.value?.focus()
  }
})

defineExpose({ open, isOpen })
</script>

<template>
  <transition enter-active-class="duration-200 ease-out" enter-from-class="translate-x-full opacity-0" enter-to-class="translate-x-0 opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="translate-x-0 opacity-100" leave-to-class="translate-x-full opacity-0">
    <div v-if="isOpen" class="absolute inset-y-3 right-3 z-50 flex w-full max-w-xl flex-col rounded-[28px] border border-cyan/40 bg-[#09090d]/98 shadow-glow">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">floating chat</div>
          <div class="mt-1 text-sm text-white">Live prompt surface</div>
        </div>
        <button class="rounded-xl border border-line px-3 py-2 font-mono text-xs text-mist transition hover:border-danger hover:text-danger" @click="close">
          close
        </button>
      </div>
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <article
          v-for="message in chat.messages.slice(-8)"
          :key="message.id"
          class="rounded-2xl border px-4 py-3"
          :class="message.role === 'user' ? 'ml-10 border-cyan/40 bg-cyan/10' : message.kind === 'feed' ? 'border-violet/40 bg-violet/10' : 'mr-10 border-line bg-panel'"
        >
          <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.25em]" :class="message.role === 'user' ? 'text-cyan' : message.kind === 'feed' ? 'text-violet' : 'text-mist'">
            {{ message.kind === 'feed' ? 'feed event' : message.role }}
          </div>
          <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm text-white">{{ message.text }}</div>
          <div v-else class="wiki-content text-sm" v-html="renderMarkdown(message.text)" />
        </article>
      </div>
      <div class="border-t border-line px-4 py-4">
        <textarea
          ref="textarea"
          v-model="prompt"
          rows="4"
          class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-sm text-white placeholder:text-slate-500"
          placeholder="Send an operator prompt…"
          @keydown.ctrl.enter.prevent="send"
        />
        <div class="mt-3 flex items-center justify-between">
          <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-mist">Ctrl+Enter to send</div>
          <div class="flex items-center gap-2">
            <button class="rounded-xl border border-danger/40 px-3 py-2 font-mono text-xs text-danger transition hover:bg-danger/10" @click="chat.abortRun()">
              abort
            </button>
            <button class="rounded-xl border border-cyan/40 bg-cyan/10 px-4 py-2 font-mono text-xs text-cyan transition hover:bg-cyan/20" @click="send">
              dispatch
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
