import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import SkillsView from '../views/SkillsView.vue'
import SquadsView from '../views/SquadsView.vue'
import AgentActivityView from '../views/AgentActivityView.vue'
import SchedulesView from '../views/SchedulesView.vue'
import FeedView from '../views/FeedView.vue'
import InboxView from '../views/InboxView.vue'
import WikiView from '../views/WikiView.vue'
import LoginView from '../views/LoginView.vue'
import McpView from '../views/McpView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/chat',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/chat',
      name: 'chat',
      component: ChatView,
    },
    {
      path: '/skills',
      name: 'skills',
      component: SkillsView,
    },
    {
      path: '/squads',
      name: 'squads',
      component: SquadsView,
    },
    {
      path: '/activity',
      name: 'activity',
      component: AgentActivityView,
    },
    {
      path: '/wiki',
      name: 'wiki',
      component: WikiView,
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: SchedulesView,
    },
    {
      path: '/feed',
      name: 'feed',
      component: FeedView,
    },
    {
      path: '/inbox',
      name: 'inbox',
      component: InboxView,
    },
    {
      path: '/notifications',
      redirect: '/feed',
    },
    {
      path: '/mcp',
      name: 'mcp',
      component: McpView,
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.init()
  }

  // Auth not configured — allow everything
  if (!auth.authEnabled) return true

  // Public routes always allowed
  if (to.meta.public) return true

  // Not authenticated — redirect to login
  if (!auth.user) return { name: 'login' }

  return true
})

export default router
