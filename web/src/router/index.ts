import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: 'Login', subtitle: 'Authenticate against Supabase', public: true },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { title: 'Chat', subtitle: 'Live orchestrator stream' },
    },
    {
      path: '/squads',
      name: 'squads',
      component: () => import('@/views/SquadsView.vue'),
      meta: { title: 'Squads', subtitle: 'Project crews and worktrees' },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('@/views/AgentActivityView.vue'),
      meta: { title: 'Activity', subtitle: 'Task execution and event stream' },
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: () => import('@/views/SchedulesView.vue'),
      meta: { title: 'Schedules', subtitle: 'Cron-driven automation matrix' },
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('@/views/SkillsView.vue'),
      meta: { title: 'Skills', subtitle: 'Installed skill manifests and content' },
    },
    {
      path: '/wiki',
      name: 'wiki',
      component: () => import('@/views/WikiView.vue'),
      meta: { title: 'Wiki', subtitle: 'Workspace knowledge browser' },
    },
    {
      path: '/mcp',
      name: 'mcp',
      component: () => import('@/views/McpView.vue'),
      meta: { title: 'MCP', subtitle: 'Server registry and transport health' },
    },
    {
      path: '/feed',
      name: 'feed',
      component: () => import('@/views/FeedView.vue'),
      meta: { title: 'Feed', subtitle: 'Notifications and durable activity' },
    },
    {
      path: '/inbox',
      name: 'inbox',
      component: () => import('@/views/InboxView.vue'),
      meta: { title: 'Inbox', subtitle: 'Operator-facing messages' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  if (to.path === '/') {
    return '/chat'
  }

  if (!auth.authEnabled) {
    if (to.path === '/login') return '/chat'
    return true
  }

  if (!auth.user && to.path !== '/login' && !to.meta.public) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (auth.user && to.path === '/login') {
    return '/chat'
  }

  return true
})

export default router
