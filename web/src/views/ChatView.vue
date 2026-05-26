<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { apiFetch } from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'

const chat = useChatStore()
const prompt = ref('')
const scrollPanel = ref<HTMLElement | null>(null)
const telemetry = ref({ version: '—', squads: 0, instances: 0, feed: 0, inbox: 0 })

const suggestions = [
  'Summarize current squad health',
  'What changed in the latest task run?',
  'List unread notifications that need action',
  'Show me upcoming schedules and risks',
]

const streamSignature = computed(() => chat.messages.map((message) => `${message.id}:${message.text.length}:${message.streaming}`).join('|'))

function scrollToBottom() {
  if (scrollPanel.value) {
    scrollPanel.value.scrollTop = scrollPanel.value.scrollHeight
  }
}

async function refreshTelemetry() {
  try {
    const [statusResponse, feedResponse, inboxResponse] = await Promise.all([
      apiFetch('/api/status'),
      apiFetch('/api/feed/count'),
      apiFetch('/api/inbox/count'),
    ])

    if (statusResponse.ok) {
      const status = await statusResponse.json() as { version?: string; squads?: number; instances?: number }
      telemetry.value.version = status.version ?? '—'
      telemetry.value.squads = status.squads ?? 0
      telemetry.value.instances = status.instances ?? 0
    }
    if (feedResponse.ok) {
      telemetry.value.feed = (await feedResponse.json() as { count: number }).count ?? 0
    }
    if (inboxResponse.ok) {
      telemetry.value.inbox = (await inboxResponse.json() as { count: number }).count ?? 0
    }
  } catch {
    // keep current values when offline
  }
}

async function send() {
  if (!prompt.value.trim()) return
  const value = prompt.value
  prompt.value = ''
  await chat.sendMessage(value)
}

watch(streamSignature, async () => {
  await nextTick()
  scrollToBottom()
})

onMounted(() => {
  refreshTelemetry()
  nextTick(scrollToBottom)
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section class="relative flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-[#050507]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div class="flex items-center justify-between border-b border-line px-5 py-3 font-mono text-xs uppercase tracking-[0.22em] text-mist">
        <div class="flex items-center gap-3">
          <span class="h-2 w-2 rounded-full bg-success animate-pulse-line" />
          <span>orchestrator stream</span>
        </div>
        <div>build {{ telemetry.version }}</div>
      </div>

      <div ref="scrollPanel" class="scanlines relative min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div v-if="!chat.messages.length" class="mx-auto max-w-3xl rounded-[28px] border border-dashed border-cyan/35 bg-cyan/5 px-8 py-10 text-center text-slate-200">
          <pre class="mb-6 overflow-auto font-mono text-xs leading-5 text-cyan">╔════════════════════════════════════╗
║   IO // MISSION CONTROL CONSOLE   ║
║  route prompts, inspect streams   ║
╚════════════════════════════════════╝</pre>
          <p class="mx-auto max-w-xl text-base leading-7 text-slate-300">Launch the orchestrator from a terminal-style surface. Suggestions below are real prompts, not placeholder chrome.</p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button v-for="suggestion in suggestions" :key="suggestion" class="rounded-full border border-line bg-panel px-4 py-2 font-mono text-xs text-slate-200 transition hover:border-cyan hover:text-cyan" @click="prompt = suggestion">
              {{ suggestion }}
            </button>
          </div>
        </div>

        <div v-else class="mx-auto max-w-4xl space-y-4">
          <article
            v-for="message in chat.messages"
            :key="message.id"
            class="animate-rise rounded-[24px] border px-4 py-4"
            :class="message.role === 'user' ? 'ml-16 border-cyan/35 bg-cyan/8' : message.kind === 'feed' ? 'mr-10 border-violet/35 bg-violet/8' : 'mr-16 border-line bg-panel/92'"
          >
            <div class="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
              <span :class="message.role === 'user' ? 'text-cyan' : message.kind === 'feed' ? 'text-violet' : 'text-mist'">
                {{ message.kind === 'feed' ? 'feed event' : message.role }}
              </span>
              <span class="text-mist">{{ new Date(message.createdAt).toLocaleTimeString() }}</span>
            </div>
            <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm leading-7 text-white">{{ message.text }}</div>
            <div v-else class="wiki-content text-sm" v-html="renderMarkdown(message.text || (message.streaming ? '…' : ''))" />
            <div v-if="message.streaming" class="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan">streaming…</div>
          </article>
        </div>
      </div>

      <div class="border-t border-line bg-[#09090d]/95 px-5 py-4">
        <textarea
          v-model="prompt"
          rows="4"
          class="focus-ring w-full rounded-[24px] border border-line bg-panel px-4 py-4 font-mono text-sm text-white placeholder:text-slate-500"
          placeholder="Type a prompt for the orchestrator. Ctrl+Enter sends."
          @keydown.ctrl.enter.prevent="send"
        />
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div class="font-mono text-[11px] uppercase tracking-[0.18em] text-mist">Ctrl+Enter send · floating chat via Ctrl+.</div>
          <div class="flex items-center gap-2">
            <button class="rounded-xl border border-line px-3 py-2 font-mono text-xs text-mist transition hover:border-danger hover:text-danger" @click="chat.clearMessages()">
              clear
            </button>
            <button class="rounded-xl border border-danger/40 px-3 py-2 font-mono text-xs text-danger transition hover:bg-danger/10" :disabled="!chat.isLoading" @click="chat.abortRun()">
              abort
            </button>
            <button class="rounded-xl border border-cyan/40 bg-cyan/10 px-4 py-2 font-mono text-xs text-cyan transition hover:bg-cyan/20" @click="send">
              dispatch
            </button>
          </div>
        </div>
      </div>
    </section>

    <aside class="grid min-h-0 gap-4 lg:grid-rows-[auto_auto_1fr]">
      <section class="rounded-[26px] border border-violet/35 bg-gradient-to-br from-violet/16 via-panel to-panel p-5 shadow-violet">
        <div class="font-mono text-[10px] uppercase tracking-[0.32em] text-violet">signal deck</div>
        <div class="mt-4 grid grid-cols-2 gap-3 font-mono text-xs uppercase tracking-[0.2em]">
          <div class="rounded-2xl border border-line bg-black/20 p-3">
            <div class="text-mist">feed</div>
            <div class="mt-2 text-2xl text-white">{{ telemetry.feed }}</div>
          </div>
          <div class="rounded-2xl border border-line bg-black/20 p-3">
            <div class="text-mist">inbox</div>
            <div class="mt-2 text-2xl text-white">{{ telemetry.inbox }}</div>
          </div>
          <div class="rounded-2xl border border-line bg-black/20 p-3">
            <div class="text-mist">squads</div>
            <div class="mt-2 text-2xl text-white">{{ telemetry.squads }}</div>
          </div>
          <div class="rounded-2xl border border-line bg-black/20 p-3">
            <div class="text-mist">instances</div>
            <div class="mt-2 text-2xl text-white">{{ telemetry.instances }}</div>
          </div>
        </div>
      </section>

      <section class="rounded-[26px] border border-line bg-surface/90 p-5">
        <div class="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">hot prompts</div>
        <div class="mt-4 space-y-2">
          <button v-for="suggestion in suggestions" :key="`hot-${suggestion}`" class="block w-full rounded-2xl border border-line bg-panel px-3 py-3 text-left text-sm text-slate-200 transition hover:border-cyan hover:text-white" @click="prompt = suggestion">
            {{ suggestion }}
          </button>
        </div>
      </section>

      <section class="rounded-[26px] border border-line bg-surface/90 p-5">
        <div class="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">operator notes</div>
        <div class="mt-4 space-y-4 text-sm leading-7 text-slate-300">
          <p>Streams append live via <span class="font-mono text-cyan">/api/events</span>. If a task stalls, abort from here without leaving the console.</p>
          <p>Feed events arriving during a run are surfaced inline so chat stays aware of squad activity.</p>
        </div>
      </section>
    </aside>
  </div>
</template>
