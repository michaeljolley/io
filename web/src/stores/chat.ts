import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch, authenticatedUrl } from '@/lib/api'

export type ChatAttachment = {
  type: 'blob'
  data: string
  mimeType: string
  displayName: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  streaming: boolean
  createdAt: string
  kind?: string
  attachments?: ChatAttachment[]
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  let eventSource: EventSource | null = null
  let activeAssistantId: string | null = null

  function getMessage(id?: string) {
    if (!messages.value.length) return null
    if (!id) return messages.value[messages.value.length - 1] ?? null
    return messages.value.find((message) => message.id === id) ?? null
  }

  function addMessage(message: Omit<ChatMessage, 'id' | 'createdAt' | 'streaming'> & Partial<Pick<ChatMessage, 'id' | 'createdAt' | 'streaming'>>) {
    const entry: ChatMessage = {
      id: message.id ?? crypto.randomUUID(),
      createdAt: message.createdAt ?? new Date().toISOString(),
      streaming: message.streaming ?? false,
      role: message.role,
      text: message.text,
      kind: message.kind,
    }
    messages.value.push(entry)
    return entry
  }

  function appendToLast(text: string, id?: string) {
    const target = getMessage(id ?? activeAssistantId ?? undefined)
    if (target) {
      target.text += text
    }
  }

  function setLastStreaming(streaming: boolean, id?: string) {
    const target = getMessage(id ?? activeAssistantId ?? undefined)
    if (target) {
      target.streaming = streaming
    }
  }

  function closeStream() {
    eventSource?.close()
    eventSource = null
    activeAssistantId = null
    isLoading.value = false
  }

  async function sendMessage(text: string, attachments: ChatAttachment[] = []) {
    const prompt = text.trim()
    if (!prompt) return

    closeStream()
    addMessage({ role: 'user', text: prompt })
    const assistant = addMessage({ role: 'assistant', text: '', streaming: true })
    activeAssistantId = assistant.id
    isLoading.value = true

    const streamUrl = await authenticatedUrl('/api/events')
    eventSource = new EventSource(streamUrl)
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>
        if (payload.type === 'delta') {
          appendToLast(String(payload.text ?? ''), assistant.id)
          return
        }
        if (payload.type === 'done') {
          setLastStreaming(false, assistant.id)
          closeStream()
          return
        }
        if (payload.type === 'feed') {
          addMessage({
            role: 'system',
            kind: 'feed',
            text: [payload.title, payload.body].filter(Boolean).join('\n') || JSON.stringify(payload, null, 2),
          })
        }
      } catch {
        appendToLast(event.data, assistant.id)
      }
    }

    eventSource.onerror = () => {
      if (!assistant.text) {
        assistant.text = 'stream disconnected'
      }
      setLastStreaming(false, assistant.id)
      closeStream()
    }

    const response = await apiFetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: prompt, attachments }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      assistant.text = errorText || `Request failed (${response.status})`
      setLastStreaming(false, assistant.id)
      closeStream()
    }
  }

  async function abortRun() {
    await apiFetch('/api/orchestrator/abort', { method: 'POST' }).catch(() => null)
    setLastStreaming(false)
    closeStream()
  }

  function clearMessages() {
    closeStream()
    messages.value = []
  }

  return {
    messages,
    isLoading,
    addMessage,
    appendToLast,
    setLastStreaming,
    sendMessage,
    abortRun,
    clearMessages,
  }
})
