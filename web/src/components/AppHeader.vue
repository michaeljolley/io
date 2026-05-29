<script setup lang="ts">
  import { useAuthStore } from "@/stores/auth";
  import { useRouter } from "vue-router";
  import { LogOut, Inbox, User } from "lucide-vue-next";

  const auth = useAuthStore();
  const router = useRouter();

  async function logout() {
    await auth.logout();
    router.push("/login");
  }
</script>

<template>
  <header
    class="h-12 border-b border-border bg-header flex items-center justify-between px-4 shrink-0"
  >
    <div></div>
    <div class="flex items-center gap-2">
      <router-link
        to="/feed"
        class="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Inbox"
      >
        <Inbox class="w-4 h-4" />
      </router-link>
      <div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center" title="User">
        <User class="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <button
        @click="logout"
        class="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Sign out"
      >
        <LogOut class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
