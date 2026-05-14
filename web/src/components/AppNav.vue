<template>
  <nav
    v-if="route.name !== 'login'"
    class="relative z-10 flex flex-col shrink-0 nav-sidebar border-r border-edge bg-surface-1/70 backdrop-blur-md"
    :class="collapsed ? 'nav-collapsed' : 'nav-expanded'"
  >
    <!-- ── Brand ── -->
    <div class="flex items-center h-14 px-3 shrink-0" :class="collapsed ? 'justify-center' : 'justify-between'">
      <div v-if="!collapsed" class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <span class="text-accent font-bold text-sm font-mono tracking-tight">IO</span>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-txt-primary leading-tight tracking-tight">IO Assistant</p>
          <p class="text-[10px] text-txt-muted leading-tight">Terminal · Dashboard</p>
        </div>
      </div>
      <div v-else class="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
        <span class="text-accent font-bold text-xs font-mono tracking-tight">IO</span>
      </div>
      <button
        v-if="!collapsed"
        @click="toggleCollapsed"
        class="p-1.5 rounded-md text-txt-muted hover:text-txt-secondary hover:bg-surface-3/50 transition-all duration-150 shrink-0 ml-1"
        title="Collapse sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>
      </button>
      <button
        v-else
        @click="toggleCollapsed"
        class="absolute -right-3 top-4 w-6 h-6 rounded-full bg-surface-2 border border-edge-bright shadow-card flex items-center justify-center text-txt-muted hover:text-accent hover:border-accent/30 transition-all duration-150 z-20"
        title="Expand sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3l5 5-5 5"/></svg>
      </button>
    </div>

    <!-- ── Divider ── -->
    <div class="mx-3 h-px bg-gradient-to-r from-transparent via-edge to-transparent"></div>

    <!-- ── Navigation ── -->
    <div class="flex-1 py-3 overflow-y-auto overflow-x-hidden">
      <ul class="space-y-0.5" :class="collapsed ? 'px-1.5' : 'px-2'">
        <li v-for="item in navItems" :key="item.to">
          <RouterLink
            :to="item.to"
            class="group flex items-center rounded-lg transition-all duration-150 relative"
            :class="[
              collapsed ? 'justify-center p-2' : 'px-2.5 py-2 gap-2.5',
              isActive(item.name)
                ? 'bg-accent/10 text-accent'
                : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-3/40'
            ]"
            :title="collapsed ? item.label : undefined"
            @click="item.name === 'notifications' ? onNotificationsClick() : item.name === 'inbox' ? onInboxClick() : undefined"
          >
            <!-- Active indicator bar -->
            <span
              v-if="isActive(item.name)"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-accent shadow-glow-sm"
              :class="collapsed ? 'h-4' : 'h-5'"
            ></span>

            <span class="text-base leading-none shrink-0 transition-transform duration-150 group-hover:scale-105" :class="collapsed ? '' : 'ml-0.5'">{{ item.icon }}</span>
            <span v-if="!collapsed" class="text-[13px] font-medium truncate">{{ item.label }}</span>

            <!-- Notification badge -->
            <span
              v-if="item.name === 'notifications' && unreadCount > 0"
              class="absolute flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-0.5 ring-2 ring-surface-1"
              :class="collapsed ? 'top-0 right-0' : 'top-0.5 right-1'"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
            <!-- Inbox count badge -->
            <span
              v-if="item.name === 'inbox' && inboxCount > 0"
              class="absolute flex items-center justify-center bg-accent text-surface-0 text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-0.5 ring-2 ring-surface-1"
              :class="collapsed ? 'top-0 right-0' : 'top-0.5 right-1'"
            >
              {{ inboxCount > 99 ? '99+' : inboxCount }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>

    <!-- ── Footer ── -->
    <div class="shrink-0">
      <div class="mx-3 h-px bg-gradient-to-r from-transparent via-edge to-transparent"></div>
      <div class="p-2.5">
        <template v-if="!collapsed">
          <template v-if="auth.authEnabled && auth.user">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-2/50 mb-1.5">
              <div class="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <span class="text-[10px] text-accent font-semibold">{{ userInitial }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-txt-primary truncate leading-tight">{{ auth.user.email }}</p>
              </div>
            </div>
            <div class="flex items-center justify-between px-2">
              <span class="flex items-center gap-1.5">
                <span v-if="version" class="text-[10px] text-txt-muted font-mono">v{{ version }}</span>
                <span class="text-[10px] text-txt-muted">·</span>
                <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-txt-muted hover:text-accent transition-colors">
                  GitHub
                </a>
              </span>
              <button
                @click="handleSignOut"
                class="text-[11px] text-txt-muted hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-surface-3/50"
              >
                Sign out
              </button>
            </div>
          </template>
          <div v-else class="flex items-center gap-1.5 px-2">
            <span v-if="version" class="text-[10px] text-txt-muted font-mono">v{{ version }}</span>
            <span class="text-[10px] text-txt-muted">·</span>
            <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-txt-muted hover:text-accent transition-colors">
              GitHub
            </a>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-col items-center gap-1.5">
            <a
              href="https://github.com/michaeljolley/io"
              target="_blank"
              rel="noopener"
              class="p-1.5 rounded-md text-txt-muted hover:text-accent hover:bg-surface-3/50 transition-all duration-150"
              title="GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
            <button
              v-if="auth.authEnabled && auth.user"
              @click="handleSignOut"
              class="p-1.5 rounded-md text-txt-muted hover:text-red-400 hover:bg-surface-3/50 transition-all duration-150"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/></svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch, authenticatedUrl } from '../lib/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const version = ref('')
const unreadCount = ref(0)
const inboxCount = ref(0)
const collapsed = ref(false)
let notificationSource: EventSource | null = null

const STORAGE_KEY = 'io-nav-collapsed'

const navItems = [
  { to: '/chat',          name: 'chat',          icon: '💬', label: 'Chat' },
  { to: '/inbox',         name: 'inbox',         icon: '📥', label: 'Inbox' },
  { to: '/skills',        name: 'skills',        icon: '⚙️',  label: 'Skills' },
  { to: '/squads',        name: 'squads',        icon: '👥', label: 'Squads' },
  { to: '/wiki',          name: 'wiki',          icon: '📚', label: 'Wiki' },
  { to: '/schedules',     name: 'schedules',     icon: '📅', label: 'Schedules' },
  { to: '/notifications', name: 'notifications', icon: '🔔', label: 'Notifications' },
  { to: '/activity',      name: 'activity',      icon: '📊', label: 'Activity' },
]

const userInitial = computed(() => {
  const email = auth.user?.email ?? ''
  return email.charAt(0).toUpperCase()
})

function isActive(name: string): boolean {
  return route.name === name
}

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

function onInboxClick() {
  inboxCount.value = 0
}

onMounted(async () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) collapsed.value = stored === 'true'
  } catch { /* ignore */ }

  try {
    const res = await apiFetch('/api/status')
    if (res.ok) {
      const data = (await res.json()) as { version?: string }
      version.value = data.version ?? ''
    }
  } catch { /* best effort */ }

  try {
    const res = await apiFetch('/api/notifications?unread=true&limit=1')
    if (res.ok) {
      const data = (await res.json()) as { unreadCount?: number }
      unreadCount.value = data.unreadCount ?? 0
    }
  } catch { /* best effort */ }

  try {
    const inboxRes = await apiFetch('/api/inbox/count')
    if (inboxRes.ok) {
      const inboxData = (await inboxRes.json()) as { count?: number }
      inboxCount.value = inboxData.count ?? 0
    }
  } catch { /* best effort */ }

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
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;
}
.nav-expanded {
  width: 240px;
}
.nav-collapsed {
  width: 56px;
}
</style>
