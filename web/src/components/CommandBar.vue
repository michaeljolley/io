<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'open-chat'): void
}>()

const router = useRouter()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)

const commands = [
  { label: 'Open chat', detail: 'Jump to /chat', to: '/chat' },
  { label: 'View squads', detail: 'Project crews, branches, and decisions', to: '/squads' },
  { label: 'Inspect activity', detail: 'Task list and live event stream', to: '/activity' },
  { label: 'Review feed', detail: 'Notifications and durable updates', to: '/feed' },
  { label: 'Open inbox', detail: 'Operator-facing inbox messages', to: '/inbox' },
  { label: 'Browse schedules', detail: 'Cron schedules and run history', to: '/schedules' },
  { label: 'Browse skills', detail: 'Installed skill markdown', to: '/skills' },
  { label: 'Browse wiki', detail: 'Workspace docs and reference', to: '/wiki' },
  { label: 'Manage MCP', detail: 'Server transports and toggles', to: '/mcp' },
  { label: 'Open quick chat', detail: 'Floating prompt surface', action: 'chat' as const },
]

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return commands
  return commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(needle))
})

function runCommand(command: (typeof commands)[number]) {
  if (command.action === 'chat') {
    emit('open-chat')
  } else if (command.to) {
    router.push(command.to)
  }
  emit('close')
}

watch(() => props.open, async (value) => {
  if (value) {
    query.value = ''
    await nextTick()
    input.value?.focus()
  }
})
</script>

<template>
  <div v-if="open" class="absolute inset-0 z-40 flex items-start justify-center bg-black/60 px-4 py-20 backdrop-blur-sm" @click.self="emit('close')">
    <div class="w-full max-w-2xl rounded-[28px] border border-cyan/35 bg-[#09090d]/96 shadow-glow">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">command bar</div>
        <input
          ref="input"
          v-model="query"
          class="mt-3 w-full border-none bg-transparent text-2xl font-semibold text-white placeholder:text-slate-500"
          placeholder="route, surface, or action"
          @keydown.esc.prevent="emit('close')"
          @keydown.enter.prevent="filtered[0] && runCommand(filtered[0])"
        />
      </div>
      <div class="max-h-[420px] overflow-y-auto p-3">
        <button
          v-for="command in filtered"
          :key="command.label"
          class="mb-2 flex w-full items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3 text-left transition hover:border-cyan hover:bg-cyan/10"
          @click="runCommand(command)"
        >
          <span>
            <span class="block text-sm font-medium text-white">{{ command.label }}</span>
            <span class="block font-mono text-[11px] uppercase tracking-[0.18em] text-mist">{{ command.detail }}</span>
          </span>
          <span class="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan">run</span>
        </button>
        <div v-if="!filtered.length" class="rounded-2xl border border-dashed border-line px-4 py-10 text-center font-mono text-xs uppercase tracking-[0.25em] text-mist">
          no command match
        </div>
      </div>
    </div>
  </div>
</template>
