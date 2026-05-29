<script setup lang="ts">
  import AppSidebar from "@/components/AppSidebar.vue";
  import AppHeader from "@/components/AppHeader.vue";
  import ChatOverlay from "@/components/ChatOverlay.vue";
  import { useAuthStore } from "@/stores/auth";
  import { computed } from "vue";
  import { useRoute } from "vue-router";

  const auth = useAuthStore();
  const route = useRoute();
  const showChrome = computed(() => auth.isAuthenticated && route.name !== "login");
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar v-if="showChrome" />
    <div class="flex-1 flex flex-col overflow-hidden">
      <AppHeader v-if="showChrome" />
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>
    </div>
    <ChatOverlay v-if="showChrome" />
  </div>
</template>
