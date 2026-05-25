<template>
  <div class="h-full p-5 flex flex-col gap-4">
    <div class="flex-1 min-h-0 bg-bg-card border border-border rounded-lg flex flex-col overflow-hidden">
      <div ref="messagesEl" class="flex-1 overflow-y-auto p-5 space-y-4" @scroll="handleScroll">
        <div v-if="!store.messages.length" class="h-full flex flex-col items-center justify-center text-center">
          <div class="text-accent-cyan/20 font-mono font-bold text-5xl mb-3">IO</div>
          <p class="text-text-muted text-sm">How can I help you today?</p>
          <div class="mt-4 flex flex-wrap justify-center gap-2"><button v-for="suggestion in suggestions" :key="suggestion" @click="useSuggestion(suggestion)" class="text-xs px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:bg-bg-elevated transition-colors">{{ suggestion }}</button></div>
        </div>
        <div v-for="msg in store.messages" :key="msg.id" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
          <div :class="['max-w-[75%] rounded-xl px-4 py-3', msg.role === 'user' ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-text text-sm' : 'chat-md bg-bg-card border border-border text-text-secondary font-mono text-xs leading-relaxed']">
            <div v-if="msg.role === 'assistant'" class="wiki-content" v-html="renderMarkdown(msg.content) + (msg.streaming ? streamCursorHtml : '')"></div>
            <template v-else>
              <span class="whitespace-pre-wrap">{{ msg.content }}</span>
              <div v-if="msg.attachments?.length" class="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-current/10">
                <span v-for="att in msg.attachments" :key="att.displayName ?? att.mimeType" class="inline-flex items-center gap-1 text-[10px] bg-black/20 rounded px-1.5 py-0.5"><svg class="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd"/></svg>{{ att.displayName ?? att.mimeType }}</span>
              </div>
            </template>
          </div>
        </div>
        <div v-if="store.isLoading && !isStreaming" class="flex justify-start"><div class="bg-bg-card border border-border rounded-xl px-4 py-3"><span class="flex gap-1.5 items-center"><span class="thinking-dot"></span><span class="thinking-dot" style="animation-delay:0.15s"></span><span class="thinking-dot" style="animation-delay:0.3s"></span></span></div></div>
      </div>
      <div class="shrink-0 border-t border-border bg-bg-surface px-4 py-3 space-y-2">
        <p v-if="fileError" class="text-xs text-accent-red">{{ fileError }}</p>
        <div v-if="pendingFiles.length" class="flex flex-wrap gap-1.5"><span v-for="(pending, i) in pendingFiles" :key="pending.file.name + i" class="inline-flex items-center gap-1.5 text-xs bg-bg-elevated border border-border rounded-md px-2 py-1 text-text-muted"><svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd"/></svg>{{ pending.file.name }}<span class="font-mono text-[10px]">{{ formatSize(pending.file.size) }}</span><button @click="removeFile(i)" class="text-text-muted hover:text-accent-red ml-0.5">×</button></span></div>
        <div class="flex items-end gap-2" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
          <button @click="fileInputEl?.click()" title="Attach file" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-accent-cyan hover:bg-bg-elevated transition-colors"><svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd"/></svg><input ref="fileInputEl" type="file" multiple class="hidden" @change="onFileInputChange" /></button>
          <textarea ref="inputEl" v-model="input" @keydown="handleKeydown" @input="autoResize" :disabled="store.isLoading" placeholder="Message IO..." rows="1" class="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none resize-none transition-colors leading-relaxed" :class="isDragging ? 'border-accent-cyan/40' : ''" style="min-height: 40px; max-height: 120px; overflow-y: auto;"></textarea>
          <button v-if="store.isLoading" @click="stopOrchestrator" :disabled="stopping" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/20 disabled:opacity-40 transition-colors"><span class="w-2.5 h-2.5 rounded-[2px] bg-current"></span></button>
          <button v-else @click="sendMessage" :disabled="!canSend" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3.105 3.71a.75.75 0 0 1 .855-.163l13 6.5a.75.75 0 0 1 0 1.342l-13 6.5a.75.75 0 0 1-1.036-.86L5.25 10l-2.326-6.29a.75.75 0 0 1 .18-.8Z"/></svg></button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import FluentIcon from '../components/FluentIcon.vue'
import { useChatStore, type MessageAttachment } from '../stores/chat'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch, authenticatedUrl } from '../lib/api'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILES = 5

interface PendingFile {
  file: File
  dataUrl: string
  base64: string
  mimeType: string
}

const store = useChatStore()
const route = useRoute()
const input = ref('')
const stopping = ref(false)
const isDragging = ref(false)
const fileError = ref<string | null>(null)
const pendingFiles = ref<PendingFile[]>([])
const messagesEl = ref<HTMLElement | null>(null)
const isScrolledUp = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)

const streamCursorHtml = '<span class="stream-cursor"></span>'

const suggestions = [
  'Check squad status',
  'Run my schedules',
  'Summarize recent activity',
  'What skills are installed?',
]

const canSend = computed(() => (input.value.trim().length > 0 || pendingFiles.value.length > 0) && !store.isLoading)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function removeFile(i: number) {
  pendingFiles.value.splice(i, 1)
}

function showFileError(msg: string) {
  fileError.value = msg
  setTimeout(() => { fileError.value = null }, 4000)
}

function readFileAsBase64(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ dataUrl, base64 })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function addFiles(files: FileList | File[]) {
  const arr = Array.from(files)
  const remaining = MAX_FILES - pendingFiles.value.length
  if (remaining <= 0) {
    showFileError(`Maximum ${MAX_FILES} files per message.`)
    return
  }
  const toAdd = arr.slice(0, remaining)
  if (arr.length > remaining) {
    showFileError(`Only ${remaining} more file(s) can be added (max ${MAX_FILES}).`)
  }
  for (const file of toAdd) {
    if (file.size > MAX_FILE_SIZE) {
      showFileError(`"${file.name}" exceeds the 5 MB limit and was skipped.`)
      continue
    }
    try {
      const { dataUrl, base64 } = await readFileAsBase64(file)
      pendingFiles.value.push({ file, dataUrl, base64, mimeType: file.type || 'application/octet-stream' })
    } catch {
      showFileError(`Failed to read "${file.name}".`)
    }
  }
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = '' // reset so same file can be re-added after removal
}

function onDragOver() { isDragging.value = true }
function onDragLeave() { isDragging.value = false }
function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

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
  const files = [...pendingFiles.value]
  if ((!text && !files.length) || store.isLoading) return

  const effectiveText = text || 'Please analyze these files.'
  const attachments: MessageAttachment[] = files.map((pf) => ({
    type: 'blob',
    data: pf.base64,
    mimeType: pf.mimeType,
    displayName: pf.file.name,
  }))

  input.value = ''
  pendingFiles.value = []
  nextTick(() => {
    if (inputEl.value) inputEl.value.style.height = 'auto'
  })
  store.isLoading = true

  // Add user message with optional attachments
  const userMsg: Parameters<typeof store.addMessage>[0] = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    ...(attachments.length ? { attachments } : {}),
  }
  store.addMessage(userMsg)
  store.addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true })

  scrollToBottom()

  const evtSource = new EventSource(await authenticatedUrl('/api/events'))
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
      body: JSON.stringify({
        text: effectiveText,
        ...(attachments.length ? { attachments } : {}),
      }),
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
@keyframes thinking { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
.thinking-dot { display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: #00d9ff; animation: thinking 1.4s ease-in-out infinite; }
.chat-md :deep(.stream-cursor) { display: inline-block; width: 2px; height: 0.9em; margin-left: 1px; background: #00d9ff; vertical-align: text-bottom; animation: cursor-blink 0.8s steps(2) infinite; }
@keyframes cursor-blink { 0% { opacity: 1; } 50% { opacity: 0; } }
.chat-md :deep(p) { margin: 0.1rem 0; }
.chat-md :deep(pre) { font-size: 0.75rem; }
.chat-md :deep(code) { font-family: 'JetBrains Mono', monospace; }
</style>
