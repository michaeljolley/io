<template>
  <nav
    v-if="route.name !== 'login'"
    class="bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 nav-sidebar"
    :class="collapsed ? 'nav-collapsed' : 'nav-expanded'"
  >
    <!-- Header -->
    <div class="p-3 border-b border-gray-800 flex items-center" :class="collapsed ? 'justify-center' : 'justify-between'">
      <div v-if="!collapsed" class="min-w-0">
        <h1 class="text-xl font-bold text-blue-400">IO</h1>
        <p class="text-xs text-gray-500">Terminal Assistant</p>
      </div>
      <span v-else class="text-xl font-bold text-blue-400">IO</span>
      <button
        @click="toggleCollapsed"
        class="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-800 shrink-0"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :class="collapsed ? '' : 'ml-2'"
      >
        <span class="text-sm font-mono select-none">{{ collapsed ? '»' : '«' }}</span>
      </button>
    </div>

    <!-- Nav links -->
    <div class="flex-1 py-4 overflow-hidden">
      <ul class="space-y-1 px-2">
        <li v-for="item in navItems" :key="item.to">
          <RouterLink
            :to="item.to"
            class="flex items-center rounded hover:bg-gray-800 transition-colors relative"
            :class="[
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 gap-2',
              route.name === item.name ? 'bg-blue-900 text-blue-300' : ''
            ]"
            :title="collapsed ? item.label : undefined"
            @click="item.name === 'notifications' ? onNotificationsClick() : undefined"
          >
            <span class="text-base leading-none shrink-0">{{ item.icon }}</span>
            <span v-if="!collapsed" class="text-sm truncate">{{ item.label }}</span>
            <!-- Notification badge -->
            <span
              v-if="item.name === 'notifications' && unreadCount > 0"
              class="absolute bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5"
              :class="collapsed ? 'top-0.5 right-0.5' : 'top-1 right-1.5'"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>

    <!-- Footer -->
    <div class="p-3 border-t border-gray-800">
      <template v-if="!collapsed">
        <template v-if="auth.authEnabled && auth.user">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs text-gray-500 truncate">{{ auth.user.email }}</p>
            <span class="flex items-center gap-1 shrink-0 ml-2">
              <span v-if="version" class="text-[10px] text-gray-600">v{{ version }}</span>
              <span v-if="version" class="text-[10px] text-gray-600">·</span>
              <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">GitHub</a>
            </span>
          </div>
          <button
            @click="handleSignOut"
            class="w-full px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            Sign out
          </button>
        </template>
        <span v-else class="flex items-center gap-1">
          <span v-if="version" class="text-[10px] text-gray-600">v{{ version }}</span>
          <span v-if="version" class="text-[10px] text-gray-600">·</span>
          <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">GitHub</a>
        </span>
      </template>
      <template v-else>
        <!-- Collapsed: sign-out icon + GitHub icon -->
        <div class="flex flex-col items-center gap-1">
          <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-gray-600 hover:text-gray-400 transition-colors" title="GitHub">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </a>
          <button
            v-if="auth.authEnabled && auth.user"
            @click="handleSignOut"
            class="flex justify-center p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Sign out"
          >
            <span class="text-sm">↩</span>
          </button>
        </div>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch, authenticatedUrl } from '../lib/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const version = ref('')
const unreadCount = ref(0)
const collapsed = ref(false)
let notificationSource: EventSource | null = null

const STORAGE_KEY = 'io-nav-collapsed'

const navItems = [
  { to: '/chat',          name: 'chat',          icon: '💬', label: 'Chat' },
  { to: '/skills',        name: 'skills',        icon: '⚙️',  label: 'Skills' },
  { to: '/squads',        name: 'squads',        icon: '👥', label: 'Squads' },
  { to: '/wiki',          name: 'wiki',          icon: '📚', label: 'Wiki' },
  { to: '/schedules',     name: 'schedules',     icon: '📅', label: 'Schedules' },
  { to: '/notifications', name: 'notifications', icon: '🔔', label: 'Notifications' },
  { to: '/activity',      name: 'activity',      icon: '📊', label: 'Activity' },
]

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try { localStorage.setItem(STORAGE_KEY, String(collapsed.value)) } catch { /* ignore */ }
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}

function onNotificationsClick() {
  unreadCount.value = 0
}

onMounted(async () => {
  // Restore collapsed state
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) collapsed.value = stored === 'true'
  } catch { /* ignore */ }

  // Fetch version
  try {
    const res = await apiFetch('/api/status')
    if (res.ok) {
      const data = (await res.json()) as { version?: string }
      version.value = data.version ?? ''
    }
  } catch { /* best effort */ }

  // Fetch initial unread count
  try {
    const res = await apiFetch('/api/notifications?unread=true&limit=1')
    if (res.ok) {
      const data = (await res.json()) as { unreadCount?: number }
      unreadCount.value = data.unreadCount ?? 0
    }
  } catch { /* best effort */ }

  // Listen for new notifications via SSE
  notificationSource = new EventSource(authenticatedUrl('/api/events'))
  notificationSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as { type?: string }
      if (data.type === 'notification' && route.name !== 'notifications') {
        unreadCount.value++
      }
    } catch { /* ignore */ }
  }
})

onUnmounted(() => {
  notificationSource?.close()
  notificationSource = null
})
</script>

<style scoped>
.nav-sidebar {
  transition: width 0.2s ease;
  overflow: hidden;
}
.nav-expanded {
  width: 256px;
}
.nav-collapsed {
  width: 60px;
}
</style>
