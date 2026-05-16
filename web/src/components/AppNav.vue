<template>
  <nav
    v-if="route.name !== 'login'"
    class="relative z-10 hidden md:flex flex-col shrink-0 nav-sidebar border-r border-edge backdrop-blur-md" style="background: linear-gradient(180deg, rgba(10,17,32,0.85) 0%, rgba(12,18,32,0.78) 50%, rgba(8,13,25,0.88) 100%)"
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
        <FluentIcon :paths='`<path d="M12.35 15.85a.5.5 0 0 1-.7 0L6.16 10.4a.55.55 0 0 1 0-.78l5.49-5.46a.5.5 0 1 1 .7.7L7.2 10l5.16 5.15c.2.2.2.5 0 .7Z"/>`' :size="14" />
      </button>
      <button
        v-else
        @click="toggleCollapsed"
        class="absolute -right-3 top-4 w-6 h-6 rounded-full bg-surface-2 border border-edge-bright shadow-card flex items-center justify-center text-txt-muted hover:text-accent hover:border-accent/30 transition-all duration-150 z-20"
        title="Expand sidebar"
      >
        <FluentIcon :paths='`<path d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"/>`' :size="12" />
      </button>
    </div>

    <!-- ── Divider ── -->
    <div class="mx-3 h-px bg-gradient-to-r from-transparent via-accent/[0.12] to-transparent"></div>

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
            @click="item.name === 'feed' ? onFeedClick() : undefined"
          >
            <!-- Active indicator bar -->
            <span
              v-if="isActive(item.name)"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-accent shadow-glow-sm"
              :class="collapsed ? 'h-4' : 'h-5'"
            ></span>

            <FluentIcon :paths="item.icon" :size="18" class="shrink-0 transition-transform duration-150 group-hover:scale-105" :class="collapsed ? '' : 'ml-0.5'" />
            <span v-if="!collapsed" class="text-[13px] font-medium truncate">{{ item.label }}</span>

            <!-- Feed unread badge -->
            <span
              v-if="item.name === 'feed' && unreadCount > 0"
              class="absolute flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-0.5 ring-2 ring-surface-1"
              :class="collapsed ? 'top-0 right-0' : 'top-0.5 right-1'"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>

    <!-- ── Footer ── -->
    <div class="shrink-0">
      <div class="mx-3 h-px bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent"></div>
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
                <a
                  v-if="version"
                  :href="releaseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="markVersionSeen"
                  class="group/ver flex items-center gap-1 hover:opacity-80 transition-opacity"
                  title="View release on GitHub"
                >
                  <span class="text-[10px] text-txt-muted font-mono group-hover/ver:text-accent transition-colors">v{{ version }}</span>
                  <span v-if="hasNewVersion" class="w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm animate-pulse"></span>
                </a>
                <span class="text-[10px] text-txt-muted">·</span>
                <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-txt-muted hover:text-accent transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
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
            <a
              v-if="version"
              :href="releaseUrl"
              target="_blank"
              rel="noopener noreferrer"
              @click="markVersionSeen"
              class="group/ver flex items-center gap-1 hover:opacity-80 transition-opacity"
              title="View release on GitHub"
            >
              <span class="text-[10px] text-txt-muted font-mono group-hover/ver:text-accent transition-colors">v{{ version }}</span>
              <span v-if="hasNewVersion" class="w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm animate-pulse"></span>
            </a>
            <span class="text-[10px] text-txt-muted">·</span>
            <a href="https://github.com/michaeljolley/io" target="_blank" rel="noopener" class="text-[10px] text-txt-muted hover:text-accent transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
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
              <FluentIcon :paths='`<path d="M9.16 16.87a.5.5 0 1 0 .67-.74L3.67 10.5H17.5a.5.5 0 0 0 0-1H3.67l6.16-5.63a.5.5 0 0 0-.67-.74L2.24 9.44a.75.75 0 0 0 0 1.11l6.92 6.32Z"/>`' :size="14" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </nav>
<!-- ── Mobile bottom navigation ── -->
<nav
  v-if="route.name !== 'login'"
  class="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch border-t border-edge"
  style="background: linear-gradient(180deg, rgba(8,13,22,0.93) 0%, rgba(5,8,15,0.98) 100%); backdrop-filter: blur(12px); padding-bottom: env(safe-area-inset-bottom)"
  aria-label="Mobile navigation"
>
  <RouterLink
    v-for="item in navItems"
    :key="item.to"
    :to="item.to"
    class="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0 transition-colors duration-150 touch-manipulation select-none"
    :class="isActive(item.name) ? 'text-accent' : 'text-txt-muted'"
    @click="item.name === 'feed' ? onFeedClick() : undefined"
    :aria-label="item.label"
  >
    <!-- Active top accent line -->
    <span v-if="isActive(item.name)" class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-accent rounded-b-full"></span>

    <span class="relative">
      <FluentIcon :paths="item.icon" :size="20" />
      <span
        v-if="item.name === 'feed' && unreadCount > 0"
        class="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[7px] font-bold rounded-full px-0.5 ring-1 ring-surface-0"
      >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </span>
    <span class="text-[9px] leading-tight font-medium truncate max-w-full px-0.5">{{ item.label }}</span>
  </RouterLink>
</nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
 import FluentIcon from './FluentIcon.vue'
import { useAuthStore } from '../stores/auth'
import { apiFetch, authenticatedUrl } from '../lib/api'
import { getSupabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const version = ref('')
const unreadCount = ref(0)
const collapsed = ref(false)
let notificationSource: EventSource | null = null

const hasNewVersion = ref(false)
const WHATS_NEW_KEY = 'io-last-seen-version'

const STORAGE_KEY = 'io-nav-collapsed'

const releaseUrl = computed(() =>
  version.value ? `https://github.com/michaeljolley/io/releases/tag/v${version.value}` : 'https://github.com/michaeljolley/io/releases'
)

const navItems = [
  { to: '/chat',          name: 'chat',          icon: '<path d="M10 2a8 8 0 1 1-3.61 15.14l-.12-.07-3.65.92a.5.5 0 0 1-.62-.45v-.08l.01-.08.92-3.64-.07-.12a7.95 7.95 0 0 1-.83-2.9l-.02-.37L2 10a8 8 0 0 1 8-8Zm0 1a7 7 0 0 0-6.1 10.42.5.5 0 0 1 .06.28l-.02.1-.75 3.01 3.02-.75a.5.5 0 0 1 .19-.01l.09.02.09.04A7 7 0 1 0 10 3Zm.5 8a.5.5 0 0 1 .09 1H7.5a.5.5 0 0 1-.09-1h3.09Zm2-3a.5.5 0 0 1 .09 1H7.5a.5.5 0 0 1-.09-1h5.09Z"/>', label: 'Chat' },
  { to: '/feed',          name: 'feed',          icon: '<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>', label: 'Feed' },
  { to: '/skills',        name: 'skills',        icon: '<path d="M9 6.5a4.5 4.5 0 0 1 6.35-4.1.5.5 0 0 1 .15.8l-2.3 2.3 1.3 1.3 2.3-2.3a.5.5 0 0 1 .8.15A4.49 4.49 0 0 1 13.5 11a4.5 4.5 0 0 1-1.1-.14l-6.37 6.45a2.36 2.36 0 0 1-3.37-3.3l6.42-6.65A4.52 4.52 0 0 1 9 6.5ZM13.5 3a3.5 3.5 0 0 0-3.39 4.39.5.5 0 0 1-.12.47L3.38 14.7a1.36 1.36 0 0 0 1.94 1.9l6.57-6.66a.5.5 0 0 1 .51-.12 3.5 3.5 0 0 0 4.53-4.05l-2.08 2.07a.5.5 0 0 1-.7 0l-2-2a.5.5 0 0 1 0-.7l2.07-2.08A3.52 3.52 0 0 0 13.5 3Z"/>', label: 'Skills' },
  { to: '/squads',        name: 'squads',        icon: '<path d="M10 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM7.5 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Zm8-.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-10 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm.6 12H5a2 2 0 0 1-2-2V9.25c0-.14.11-.25.25-.25h1.76c.04-.37.17-.7.37-1H3.25C2.56 8 2 8.56 2 9.25V13a3 3 0 0 0 3.4 2.97 4.96 4.96 0 0 1-.3-.97Zm9.5.97A3 3 0 0 0 18 13V9.25C18 8.56 17.44 8 16.75 8h-2.13c.2.3.33.63.37 1h1.76c.14 0 .25.11.25.25V13a2 2 0 0 1-2.1 2c-.07.34-.17.66-.3.97ZM7.25 8C6.56 8 6 8.56 6 9.25V14a4 4 0 0 0 8 0V9.25C14 8.56 13.44 8 12.75 8h-5.5ZM7 9.25c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25V14a3 3 0 1 1-6 0V9.25Z"/>', label: 'Squads' },
  { to: '/wiki',          name: 'wiki',          icon: '<path d="M10 16c-.46.6-1.18 1-2 1H3.5A1.5 1.5 0 0 1 2 15.5v-11C2 3.67 2.67 3 3.5 3H8c.82 0 1.54.4 2 1 .46-.6 1.18-1 2-1h4.5c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5H12a2.5 2.5 0 0 1-2-1ZM3 4.5v11c0 .28.22.5.5.5H8c.83 0 1.5-.67 1.5-1.5v-9C9.5 4.67 8.83 4 8 4H3.5a.5.5 0 0 0-.5.5Zm7.5 10c0 .83.67 1.5 1.5 1.5h4.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H12c-.83 0-1.5.67-1.5 1.5v9Z"/>', label: 'Wiki' },
  { to: '/schedules',     name: 'schedules',     icon: '<path d="M7 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4-5.5A2.5 2.5 0 0 0 14.5 3h-9A2.5 2.5 0 0 0 3 5.5v9A2.5 2.5 0 0 0 5.5 17h9a2.5 2.5 0 0 0 2.5-2.5v-9ZM4 7h12v7.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5V7Zm1.5-3h9c.83 0 1.5.67 1.5 1.5V6H4v-.5C4 4.67 4.67 4 5.5 4Z"/>', label: 'Schedules' },
  { to: '/activity',      name: 'activity',      icon: '<path d="M16.52 9c.26 0 .48-.2.48-.46V8.5A6.5 6.5 0 0 0 10.5 2h-.04a.47.47 0 0 0-.46.48V8.5c0 .28.22.5.5.5h6.02ZM11 3.02A5.5 5.5 0 0 1 15.98 8H11V3.02ZM8 9V5.1A5 5 0 0 0 9 15v1a6 6 0 0 1-.5-11.98c.28-.02.5.2.5.48V9a1 1 0 0 0 1 1h4.5c.28 0 .5.22.48.5a6 6 0 0 1-.06.5H10a2 2 0 0 1-2-2Zm9 1a1 1 0 0 0-1 1v7a1 1 0 1 0 2 0v-7a1 1 0 0 0-1-1Zm-3 2a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Zm-4 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0v-3Z"/>', label: 'Activity' },
]

const userInitial = computed(() => {
  const email = auth.user?.email ?? ''
  return email.charAt(0).toUpperCase()
})

function isActive(name: string): boolean {
  return route.name === name
}

function markVersionSeen() {
  try { localStorage.setItem(WHATS_NEW_KEY, version.value) } catch { /* ignore */ }
  hasNewVersion.value = false
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try { localStorage.setItem(STORAGE_KEY, String(collapsed.value)) } catch { /* ignore */ }
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}

function onFeedClick() {
  unreadCount.value = 0
}

onMounted(async () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) collapsed.value = stored === 'true'
  } catch { /* ignore */ }

  // Wait for auth to be fully initialized before making API calls.
  // AppNav mounts before the router guard finishes auth.init(), so
  // without this guard, requests fire with no token and get 401s.
  await auth.init()

  // Skip authenticated API calls when on the login page
  if (auth.authEnabled && !auth.user) return

  try {
    const res = await apiFetch('/api/status')
    if (res.ok) {
      const data = (await res.json()) as { version?: string }
      version.value = data.version ?? ''
      try {
        const lastSeen = localStorage.getItem(WHATS_NEW_KEY)
        if (version.value && version.value !== lastSeen) hasNewVersion.value = true
      } catch { /* ignore */ }
    }
  } catch { /* best effort */ }

  try {
    const res = await apiFetch('/api/feed/count')
    if (res.ok) {
      const data = (await res.json()) as { count?: number }
      unreadCount.value = data.count ?? 0
    }
  } catch { /* best effort */ }

  connectSSE()
})

async function connectSSE(retries = 0) {
  notificationSource?.close()
  notificationSource = null

  const es = new EventSource(await authenticatedUrl('/api/events'))
  notificationSource = es

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as { type?: string }
      if (data.type === 'feed' && route.name !== 'feed') {
        unreadCount.value++
      }
    } catch { /* ignore */ }
  }

  es.onerror = async () => {
    es.close()
    if (notificationSource === es) {
      notificationSource = null
    }
    if (retries >= 3) return // give up after 3 retries

    // Refresh token before reconnecting so the new URL carries a valid JWT
    try {
      const supabase = await getSupabase()
      if (supabase) await supabase.auth.refreshSession()
    } catch { /* best effort */ }

    setTimeout(() => connectSSE(retries + 1), 2000 * (retries + 1))
  }
}

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
