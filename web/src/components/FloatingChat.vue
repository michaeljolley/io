<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { renderMarkdown } from '@/lib/markdown'
import { useChatStore, type ChatAttachment } from '@/stores/chat'

const chat = useChatStore()
const prompt = ref('')
const isOpen = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const scrollPanel = ref<HTMLElement | null>(null)
const selectedFiles = ref<File[]>([])
const filePreviewData = ref<Array<{ file: File, preview: string | null }>>([])

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

async function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  const errors: string[] = []

  for (const file of files) {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} exceeds 5MB limit`)
      continue
    }

    // Validate file type (optional but recommended)
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt|jpg|jpeg|png|gif|webp)$/i)) {
      errors.push(`${file.name} has unsupported file type`)
      continue
    }

    selectedFiles.value.push(file)

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        filePreviewData.value.push({
          file,
          preview: e.target?.result as string,
        })
      }
      reader.readAsDataURL(file)
    } else {
      filePreviewData.value.push({
        file,
        preview: null,
      })
    }
  }

  if (errors.length > 0) {
    // Show validation errors (could use a toast notification in a real app)
    console.warn('File validation errors:', errors)
  }

  // Reset input
  input.value = ''
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
  filePreviewData.value.splice(index, 1)
}

async function convertFilesToAttachments(): Promise<ChatAttachment[]> {
  const attachments: ChatAttachment[] = []

  for (const file of selectedFiles.value) {
    const reader = new FileReader()
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    attachments.push({
      type: 'blob',
      data,
      mimeType: file.type,
      displayName: file.name,
    })
  }

  return attachments
}

async function send() {
  const value = prompt.value.trim()
  const hasAttachments = selectedFiles.value.length > 0
  if (!value && !hasAttachments) return

  prompt.value = ''
  const attachments = await convertFilesToAttachments()
  selectedFiles.value = []
  filePreviewData.value = []

  await chat.sendMessage(value, attachments)
}

function openFileInput() {
  fileInputRef.value?.click()
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
  <div class="fixed bottom-14 right-0 z-50 flex w-full flex-col md:bottom-10 md:right-4 md:w-[360px]">
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

        <!-- Messages -->
        <div ref="scrollPanel" class="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          <div v-for="message in displayMessages" :key="message.id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed" :class="message.role === 'user' ? 'rounded-br-sm border border-primary/20 bg-primary/15 font-mono text-primary' : 'rounded-bl-sm border border-white/[0.06] bg-white/[0.04] text-foreground/75'">
              <div v-if="message.role === 'user'" class="whitespace-pre-wrap">{{ message.text }}</div>
              <div v-else class="wiki-content text-xs" v-html="renderMarkdown(message.text || (message.streaming ? '…' : ''))" />

              <!-- Display attachments in messages -->
              <div v-if="message.attachments && message.attachments.length > 0" class="mt-2 space-y-1">
                <div v-for="(attachment, idx) in message.attachments" :key="`${message.id}-${idx}`">
                  <img v-if="attachment.type === 'image'" :src="attachment.data" :alt="attachment.displayName" class="max-w-full max-h-32 rounded border border-border/50" />
                  <a v-else class="flex items-center gap-1 text-[10px] text-primary hover:underline" :href="attachment.data" :download="attachment.displayName">
                    <AppIcon name="zap" class="h-2.5 w-2.5" />
                    <span>{{ attachment.displayName }}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- File previews -->
        <div v-if="filePreviewData.length > 0" class="flex-shrink-0 border-t border-border/50 px-3 py-2">
          <div class="flex gap-2 overflow-x-auto">
            <div v-for="(item, idx) in filePreviewData" :key="`preview-${idx}`" class="relative shrink-0">
              <img v-if="item.preview" :src="item.preview" :alt="item.file.name" class="h-12 w-12 rounded border border-border object-cover" />
              <div v-else class="flex h-12 w-12 items-center justify-center rounded border border-border bg-card text-[8px] text-foreground/50">
                <span class="text-center">{{ item.file.name.split('.').pop()?.toUpperCase() }}</span>
              </div>
              <button class="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white transition-colors hover:bg-destructive/80" @click="removeFile(idx)">
                <AppIcon name="x" class="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Collapsed bar and input -->
    <div class="overflow-hidden border border-border bg-sidebar" :class="isOpen ? 'rounded-b-xl border-t-0' : 'rounded-xl'">
      <!-- File input (hidden) -->
      <input ref="fileInputRef" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" class="hidden" @change="onFileSelect" />

      <form v-if="isOpen" class="flex items-center gap-2 border-t border-border/50 px-3 py-2.5" @submit.prevent="send">
        <button type="button" class="flex shrink-0 items-center rounded border border-border/50 px-2 py-1.5 text-muted-foreground/50 transition-colors hover:border-primary/50 hover:text-primary" @click="openFileInput">
          <AppIcon name="zap" class="h-3.5 w-3.5" />
        </button>
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
