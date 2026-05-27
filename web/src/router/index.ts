import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    name: "chat",
    component: () => import("@/views/ChatView.vue"),
  },
  {
    path: "/squads",
    name: "squads",
    component: () => import("@/views/SquadsView.vue"),
  },
  {
    path: "/squads/:id",
    name: "squad-detail",
    component: () => import("@/views/SquadDetailView.vue"),
  },
  {
    path: "/feed",
    name: "feed",
    component: () => import("@/views/FeedView.vue"),
  },
  {
    path: "/skills",
    name: "skills",
    component: () => import("@/views/SkillsView.vue"),
  },
  {
    path: "/mcp",
    name: "mcp",
    component: () => import("@/views/McpView.vue"),
  },
  {
    path: "/schedules",
    name: "schedules",
    component: () => import("@/views/SchedulesView.vue"),
  },
  {
    path: "/wiki",
    name: "wiki",
    component: () => import("@/views/WikiView.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/views/SettingsView.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: "login" };
  }
});
