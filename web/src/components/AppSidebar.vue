<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 md:hidden flex" @click.self="$emit('navigate')">
      <div class="absolute inset-0 bg-black/60" @click="$emit('navigate')"></div>
      <nav class="relative w-48 h-full bg-bg-surface border-r border-border flex flex-col py-2 overflow-y-auto">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" @click="$emit('navigate')" class="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors" :class="isActive(item.name) ? 'text-accent-cyan bg-bg-elevated' : 'text-text-muted hover:text-text hover:bg-bg-elevated'">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" v-html="item.icon"></svg>
          {{ item.label }}
          <span v-if="item.name === 'inbox' && inboxCount > 0" class="ml-auto w-2 h-2 rounded-full bg-accent-red"></span>
        </router-link>
      </nav>
    </div>
  </Teleport>
  <aside class="hidden md:flex shrink-0 w-[39px] flex-col items-center py-2 gap-0.5 bg-bg-surface border-r border-border relative">
    <router-link v-for="item in navItems" :key="item.to" :to="item.to" :title="item.label" class="relative flex items-center justify-center w-[39px] h-[39px] transition-colors" :class="isActive(item.name) ? 'text-accent-cyan' : 'text-text-muted hover:text-text hover:bg-bg-elevated'">
      <span v-if="isActive(item.name)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[23px] bg-accent-cyan rounded-r"></span>
      <svg class="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="currentColor" v-html="item.icon"></svg>
      <span v-if="item.name === 'inbox' && inboxCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-red"></span>
    </router-link>
  </aside>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../stores/auth'

defineProps<{ visible?: boolean }>()
defineEmits<{ navigate: [] }>()

const route = useRoute()
const auth = useAuthStore()
const inboxCount = ref(0)

const navItems = [
  { to: '/chat',      name: 'chat',      icon: '<path d="M10 2a8 8 0 1 1-3.61 15.14l-.12-.07-3.65.92a.5.5 0 0 1-.62-.45v-.08l.01-.08.92-3.64-.07-.12a7.95 7.95 0 0 1-.83-2.9l-.02-.37L2 10a8 8 0 0 1 8-8Zm0 1a7 7 0 0 0-6.1 10.42.5.5 0 0 1 .06.28l-.02.1-.75 3.01 3.02-.75a.5.5 0 0 1 .19-.01l.09.02.09.04A7 7 0 1 0 10 3Z"/>', label: 'Chat' },
  { to: '/squads',    name: 'squads',    icon: '<path d="M10 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM7.5 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Zm8-.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-10 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm.6 12H5a2 2 0 0 1-2-2V9.25c0-.14.11-.25.25-.25h1.76c.04-.37.17-.7.37-1H3.25C2.56 8 2 8.56 2 9.25V13a3 3 0 0 0 3.4 2.97 4.96 4.96 0 0 1-.3-.97Zm9.5.97A3 3 0 0 0 18 13V9.25C18 8.56 17.44 8 16.75 8h-2.13c.2.3.33.63.37 1h1.76c.14 0 .25.11.25.25V13a2 2 0 0 1-2.1 2c-.07.34-.17.66-.3.97ZM7.25 8C6.56 8 6 8.56 6 9.25V14a4 4 0 0 0 8 0V9.25C14 8.56 13.44 8 12.75 8h-5.5ZM7 9.25c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25V14a3 3 0 1 1-6 0V9.25Z"/>', label: 'Squads' },
  { to: '/activity',  name: 'activity',  icon: '<path d="M16.52 9c.26 0 .48-.2.48-.46V8.5A6.5 6.5 0 0 0 10.5 2h-.04a.47.47 0 0 0-.46.48V8.5c0 .28.22.5.5.5h6.02ZM11 3.02A5.5 5.5 0 0 1 15.98 8H11V3.02ZM8 9V5.1A5 5 0 0 0 9 15v1a6 6 0 0 1-.5-11.98c.28-.02.5.2.5.48V9a1 1 0 0 0 1 1h4.5c.28 0 .5.22.48.5a6 6 0 0 1-.06.5H10a2 2 0 0 1-2-2Zm9 1a1 1 0 0 0-1 1v7a1 1 0 1 0 2 0v-7a1 1 0 0 0-1-1Zm-3 2a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Zm-4 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0v-3Z"/>', label: 'Activity' },
  { to: '/schedules', name: 'schedules', icon: '<path d="M7 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4-5.5A2.5 2.5 0 0 0 14.5 3h-9A2.5 2.5 0 0 0 3 5.5v9A2.5 2.5 0 0 0 5.5 17h9a2.5 2.5 0 0 0 2.5-2.5v-9ZM4 7h12v7.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5V7Zm1.5-3h9c.83 0 1.5.67 1.5 1.5V6H4v-.5C4 4.67 4.67 4 5.5 4Z"/>', label: 'Schedules' },
  { to: '/skills',    name: 'skills',    icon: '<path d="M9 6.5a4.5 4.5 0 0 1 6.35-4.1.5.5 0 0 1 .15.8l-2.3 2.3 1.3 1.3 2.3-2.3a.5.5 0 0 1 .8.15A4.49 4.49 0 0 1 13.5 11a4.5 4.5 0 0 1-1.1-.14l-6.37 6.45a2.36 2.36 0 0 1-3.37-3.3l6.42-6.65A4.52 4.52 0 0 1 9 6.5Z"/>', label: 'Skills' },
  { to: '/wiki',      name: 'wiki',      icon: '<path d="M10 16c-.46.6-1.18 1-2 1H3.5A1.5 1.5 0 0 1 2 15.5v-11C2 3.67 2.67 3 3.5 3H8c.82 0 1.54.4 2 1 .46-.6 1.18-1 2-1h4.5c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5H12a2.5 2.5 0 0 1-2-1ZM3 4.5v11c0 .28.22.5.5.5H8c.83 0 1.5-.67 1.5-1.5v-9C9.5 4.67 8.83 4 8 4H3.5a.5.5 0 0 0-.5.5Zm7.5 10c0 .83.67 1.5 1.5 1.5h4.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H12c-.83 0-1.5.67-1.5 1.5v9Z"/>', label: 'Wiki' },
  { to: '/mcp',       name: 'mcp',       icon: '<path d="M13.5 5a1.5 1.5 0 1 1 0 3h-1v1.5a.5.5 0 0 1-1 0V8h-3v1.5a.5.5 0 0 1-1 0V8h-1a1.5 1.5 0 1 1 0-3h1V3.5a.5.5 0 0 1 1 0V5h3V3.5a.5.5 0 0 1 1 0V5h1Zm0 1h-7a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1ZM4 12.5A2.5 2.5 0 0 1 6.5 10h7a2.5 2.5 0 0 1 2.5 2.5v2a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 14.5v-2Zm2.5-1.5A1.5 1.5 0 0 0 5 12.5v2A1.5 1.5 0 0 0 6.5 16h7a1.5 1.5 0 0 0 1.5-1.5v-2a1.5 1.5 0 0 0-1.5-1.5h-7Z"/>', label: 'MCP' },
  { to: '/inbox',     name: 'inbox',     icon: '<path d="M2 6.25A2.25 2.25 0 0 1 4.25 4h11.5A2.25 2.25 0 0 1 18 6.25v7.5A2.25 2.25 0 0 1 15.75 16H4.25A2.25 2.25 0 0 1 2 13.75v-7.5Zm2.25-1a1 1 0 0 0-1 1v.388l6.75 4.5 6.75-4.5V6.25a1 1 0 0 0-1-1H4.25Zm12.5 2.834-6.294 4.196a.75.75 0 0 1-.812 0L3.25 8.084v5.666a1 1 0 0 0 1 1h11.5a1 1 0 0 0 1-1V8.084Z"/>', label: 'Inbox' },
]

function isActive(name: string): boolean {
  return route.name === name
}

onMounted(async () => {
  await auth.init()
  if (auth.authEnabled && !auth.user) return
  try {
    const res = await apiFetch('/api/inbox/count')
    if (res.ok) {
      const data = (await res.json()) as { count?: number }
      inboxCount.value = data.count ?? 0
    }
  } catch { /* best effort */ }
})
</script>
