<template>
  <nav v-if="route.name !== 'login'" class="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
    <div class="p-6 border-b border-gray-800">
      <h1 class="text-xl font-bold text-blue-400">IO</h1>
      <p class="text-xs text-gray-500">Terminal Assistant</p>
    </div>
    
    <div class="flex-1 py-6">
      <ul class="space-y-2 px-3">
        <li>
          <RouterLink
            to="/chat"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'chat' }"
          >
            💬 Chat
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/skills"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'skills' }"
          >
            ⚙️ Skills
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/squads"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'squads' }"
          >
            👥 Squads
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/schedules"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'schedules' }"
          >
            📅 Schedules
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/notifications"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors relative"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'notifications' }"
            @click="onNotificationsClick"
          >
            🔔 Notifications
            <span
              v-if="unreadCount > 0"
              class="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/activity"
            class="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
            :class="{ 'bg-blue-900 text-blue-300': route.name === 'activity' }"
          >
            📊 Activity
          </RouterLink>
        </li>
      </ul>
    </div>

    <div class="p-4 border-t border-gray-800">
      <template v-if="auth.authEnabled && auth.user">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs text-gray-500 truncate">{{ auth.user.email }}</p>
          <span v-if="version" class="text-[10px] text-gray-600 shrink-0 ml-2">v{{ version }}</span>
        </div>
        <button
          @click="handleSignOut"
          class="w-full px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        >
          Sign out
        </button>
      </template>
      <span v-else-if="version" class="text-[10px] text-gray-600">v{{ version }}</span>
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
let notificationSource: EventSource | null = null

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}

function onNotificationsClick() {
  unreadCount.value = 0
}

onMounted(async () => {
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

  // Listen for new notifications via the shared SSE events stream
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
