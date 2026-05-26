<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  (event: 'open-command'): void
  (event: 'open-chat'): void
}>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const now = ref(new Date())
let timer = 0

const title = computed(() => String(route.meta.title ?? 'Mission Control'))
const subtitle = computed(() => String(route.meta.subtitle ?? 'Operational surface'))
const initials = computed(() => auth.user?.email?.slice(0, 2).toUpperCase() ?? 'IO')

async function signOut() {
  await auth.signOut()
  router.push('/login')
}

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  window.clearInterval(timer)
})
</script>

<template>
  <header class="relative z-10 px-4 pt-4">
    <div class="panel-shell flex items-center justify-between gap-4 rounded-[22px] border-b border-cyan/40 bg-surface/90 px-5 py-3 shadow-glow">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <span class="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">{{ route.name }}</span>
          <span class="rounded-full border border-violet/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-violet">live surface</span>
        </div>
        <div class="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 class="text-2xl font-semibold tracking-tight text-white">{{ title }}</h1>
          <p class="font-mono text-xs text-mist">{{ subtitle }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="hidden rounded-2xl border border-line bg-black/25 px-3 py-2 text-right font-mono text-[11px] text-mist xl:block">
          <div>{{ now.toLocaleDateString() }}</div>
          <div class="text-cyan">{{ now.toLocaleTimeString() }}</div>
        </div>
        <button class="rounded-2xl border border-line bg-panel px-3 py-2 font-mono text-xs text-mist transition hover:border-cyan hover:text-white" @click="emit('open-command')">
          ⌘K Command
        </button>
        <button class="rounded-2xl border border-cyan/40 bg-cyan/10 px-3 py-2 font-mono text-xs text-cyan transition hover:bg-cyan/20" @click="emit('open-chat')">
          Quick chat
        </button>
        <div class="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-violet/40 bg-violet/10 font-mono text-xs font-semibold text-violet">
            {{ initials }}
          </div>
          <div class="hidden min-w-0 sm:block">
            <div class="max-w-44 truncate text-sm text-white">{{ auth.user?.email ?? 'guest mode' }}</div>
            <div class="font-mono text-[11px] uppercase tracking-[0.24em] text-mist">operator</div>
          </div>
          <button class="rounded-xl border border-line px-2 py-1 font-mono text-[11px] text-mist transition hover:border-danger hover:text-danger" @click="signOut">
            sign out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
