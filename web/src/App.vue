<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import { useAuthStore } from "@/stores/auth";
import { computed } from "vue";
import { useRoute } from "vue-router";

const auth = useAuthStore();
const route = useRoute();
const showSidebar = computed(() => auth.isAuthenticated && route.name !== "login");
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar v-if="showSidebar" />
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
