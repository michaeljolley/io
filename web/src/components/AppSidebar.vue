<script setup lang="ts">
  import { ref, computed } from "vue";
  import { useRoute } from "vue-router";
  import LogoIcon from "@/components/LogoIcon.vue";
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
    BarChart3,
    ClipboardList,
    PanelLeftClose,
    PanelLeftOpen,
    Github,
  } from "lucide-vue-next";

  const route = useRoute();

  const collapsed = ref(false);

  const navItems = [
    { name: "History", icon: History, path: "/history" },
    { name: "Squads", icon: Users, path: "/squads" },
    { name: "Health", icon: Activity, path: "/squads/health" },
    { name: "Usage", icon: BarChart3, path: "/usage" },
    { name: "Audit Log", icon: ClipboardList, path: "/audit-log" },
    { name: "Skills", icon: Puzzle, path: "/skills" },
    { name: "MCP Servers", icon: Server, path: "/mcp" },
    { name: "Schedules", icon: Clock, path: "/schedules" },
    { name: "Wiki", icon: BookOpen, path: "/wiki" },
  ];

  const footerItems = [
    { name: "Chat", icon: MessageSquare, path: "/" },
    { name: "Feed", icon: Inbox, path: "/feed" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ];

  const APP_VERSION = __APP_VERSION__;
  const REPO_URL = "https://github.com/michaeljolley/io";

  // Find the best (longest prefix) matching nav path for the current route.
  const activeNavPath = computed(() => {
    let bestPath = "";
    const allItems = [...navItems, ...footerItems];
    for (const item of allItems) {
      const p = item.path;
      const matches =
        p === "/" ? route.path === "/" : route.path === p || route.path.startsWith(p + "/");
      if (matches && p.length > bestPath.length) {
        bestPath = p;
      }
    }
    return bestPath;
  });

  function toggleCollapse() {
    collapsed.value = !collapsed.value;
  }
</script>

<template>
  <aside
    :class="[
      'border-r border-border bg-sidebar flex flex-col h-full shrink-0 transition-all duration-200',
      collapsed ? 'w-16' : 'w-56',
    ]"
  >
    <!-- Logo + Collapse toggle -->
    <div
      class="p-3 border-b border-border flex items-center"
      :class="collapsed ? 'justify-center' : 'justify-between'"
    >
      <router-link
        to="/"
        class="flex items-center gap-2"
        :class="collapsed ? 'justify-center' : ''"
      >
        <LogoIcon :size="24" />
        <h1
          v-if="!collapsed"
          class="font-display text-[1.1rem] font-normal uppercase tracking-[0.18em] bg-gradient-brand bg-clip-text text-transparent"
        >
          IO
        </h1>
      </router-link>
      <button
        @click="toggleCollapse"
        class="p-1 rounded-full hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-colors"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        v-if="!collapsed"
      >
        <PanelLeftClose class="w-4 h-4" />
      </button>
    </div>

    <!-- Expand button when collapsed -->
    <button
      v-if="collapsed"
      @click="toggleCollapse"
      class="mx-auto mt-2 p-1.5 rounded-full hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-colors"
      title="Expand sidebar"
    >
      <PanelLeftOpen class="w-4 h-4" />
    </button>

    <!-- Navigation -->
    <nav class="flex-1 p-2 space-y-0.5 overflow-y-auto">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 rounded-full text-sm transition-colors border border-transparent"
        :class="[
          collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
          activeNavPath === item.path
            ? 'bg-accent text-accent-foreground font-medium border border-white/10'
            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
        ]"
        :title="collapsed ? item.name : undefined"
      >
        <component :is="item.icon" class="w-4 h-4 shrink-0" />
        <span v-if="!collapsed">{{ item.name }}</span>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="border-t border-border p-2 space-y-0.5">
      <router-link
        v-for="item in footerItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 rounded-full text-sm transition-colors border border-transparent"
        :class="[
          collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
          activeNavPath === item.path
            ? 'bg-accent text-accent-foreground font-medium border border-white/10'
            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
        ]"
        :title="collapsed ? item.name : undefined"
      >
        <component :is="item.icon" class="w-4 h-4 shrink-0" />
        <span v-if="!collapsed">{{ item.name }}</span>
      </router-link>

      <!-- Version + GitHub -->
      <div
        class="flex items-center pt-2 mt-2 border-t border-border"
        :class="collapsed ? 'justify-center' : 'justify-between px-3'"
      >
        <a
          v-if="!collapsed"
          :href="`${REPO_URL}/releases/tag/v${APP_VERSION}`"
          target="_blank"
          class="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Release notes"
        >
          v{{ APP_VERSION }}
        </a>
        <a
          :href="REPO_URL"
          target="_blank"
          class="p-1 rounded-full hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-colors"
          title="GitHub repository"
        >
          <Github class="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  </aside>
</template>
