<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import {
  MessageSquare,
  Users,
  Activity,
  Inbox,
  Puzzle,
  Server,
  Clock,
  BookOpen,
  History,
  Settings,
  LogOut,
  BarChart3,
  ClipboardList,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navItems = [
  { name: "Chat", icon: MessageSquare, path: "/" },
  { name: "History", icon: History, path: "/history" },
  { name: "Squads", icon: Users, path: "/squads" },
  { name: "Health", icon: Activity, path: "/squads/health" },
  { name: "Feed", icon: Inbox, path: "/feed" },
  { name: "Usage", icon: BarChart3, path: "/usage" },
  { name: "Audit Log", icon: ClipboardList, path: "/audit-log" },
  { name: "Skills", icon: Puzzle, path: "/skills" },
  { name: "MCP Servers", icon: Server, path: "/mcp" },
  { name: "Schedules", icon: Clock, path: "/schedules" },
  { name: "Wiki", icon: BookOpen, path: "/wiki" },
  { name: "Settings", icon: Settings, path: "/settings" },
];

// Find the best (longest prefix) matching nav path for the current route.
// This ensures /squads/health activates "Health" rather than "Squads".
const activeNavPath = computed(() => {
  let bestPath = "";
  for (const item of navItems) {
    const p = item.path;
    const matches =
      p === "/"
        ? route.path === "/"
        : route.path === p || route.path.startsWith(p + "/");
    if (matches && p.length > bestPath.length) {
      bestPath = p;
    }
  }
  return bestPath;
});

async function logout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <aside class="w-64 border-r border-border bg-card flex flex-col h-full shrink-0">
    <!-- Logo -->
    <div class="p-4 border-b border-border">
      <h1 class="text-xl font-bold tracking-tight">🤖 IO</h1>
      <p class="text-xs text-muted-foreground mt-1">Personal AI Assistant</p>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-2 space-y-1 overflow-y-auto">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
        :class="[
          activeNavPath === item.path
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
        ]"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.name }}
      </router-link>
    </nav>

    <!-- User section -->
    <div class="p-3 border-t border-border">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground truncate">{{ auth.email }}</span>
        <button
          @click="logout"
          class="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>
