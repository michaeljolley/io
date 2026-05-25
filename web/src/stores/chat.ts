import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface MessageAttachment {
  type: 'blob'
  data: string
  mimeType: string
  displayName?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  attachments?: MessageAttachment[]
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg)
  }

  function appendToLast(text: string) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      last.content += text
    }
  }

  function setLastStreaming(streaming: boolean) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      last.streaming = streaming
    }
  }

  return { messages, isLoading, addMessage, appendToLast, setLastStreaming }
})
