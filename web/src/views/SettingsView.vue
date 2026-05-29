<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { apiGet, apiPut } from "@/lib/api";

  const loading = ref(true);
  const saving = ref(false);
  const saved = ref(false);
  const activeTab = ref("general");

  const tabs = [
    { id: "general", label: "General" },
    { id: "telegram", label: "Telegram" },
    { id: "auth", label: "Auth" },
    { id: "advanced", label: "Advanced" },
  ];

  const settings = ref({
    defaultModel: "",
    port: 3170,
    telegramEnabled: false,
    telegramBotToken: "",
    authorizedUserId: null as number | null,
    supabaseUrl: "",
    supabaseAnonKey: "",
    authorizedEmail: "",
    backgroundNotifyMode: "meaningful",
    backgroundNotifyTelegram: true,
    selfEditEnabled: false,
    watchdogEnabled: true,
  });

  async function fetchSettings() {
    loading.value = true;
    try {
      const data = await apiGet("/settings");
      settings.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings() {
    saving.value = true;
    saved.value = false;
    try {
      await apiPut("/settings", settings.value);
      saved.value = true;
      setTimeout(() => (saved.value = false), 2000);
    } finally {
      saving.value = false;
    }
  }

  onMounted(fetchSettings);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Settings</h1>
      <button
        @click="saveSettings"
        :disabled="saving"
        class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
      >
        {{ saving ? "Saving..." : saved ? "Saved ✓" : "Save" }}
      </button>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex gap-1 border-b border-border mb-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === tab.id
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- General -->
      <div v-if="activeTab === 'general'" class="space-y-4 max-w-lg">
        <div>
          <label class="text-sm font-medium">Default Model</label>
          <input
            v-model="settings.defaultModel"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Port</label>
          <input
            v-model.number="settings.port"
            type="number"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p class="text-xs text-muted-foreground mt-1">Requires restart to take effect</p>
        </div>
        <div>
          <label class="text-sm font-medium">Background Notify Mode</label>
          <select
            v-model="settings.backgroundNotifyMode"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="meaningful">Meaningful</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="settings.backgroundNotifyTelegram"
            type="checkbox"
            id="notifyTelegram"
            class="rounded"
          />
          <label for="notifyTelegram" class="text-sm font-medium"
            >Send notifications via Telegram</label
          >
        </div>
      </div>

      <!-- Telegram -->
      <div v-if="activeTab === 'telegram'" class="space-y-4 max-w-lg">
        <div>
          <label class="text-sm font-medium">Bot Token</label>
          <input
            v-model="settings.telegramBotToken"
            type="password"
            placeholder="Enter new token to update"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Authorized User ID</label>
          <input
            v-model.number="settings.authorizedUserId"
            type="number"
            placeholder="123456789"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="settings.telegramEnabled"
            type="checkbox"
            id="telegramEnabled"
            class="rounded"
          />
          <label for="telegramEnabled" class="text-sm font-medium">Enable Telegram Bot</label>
        </div>
      </div>

      <!-- Auth -->
      <div v-if="activeTab === 'auth'" class="space-y-4 max-w-lg">
        <div>
          <label class="text-sm font-medium">Supabase URL</label>
          <input
            v-model="settings.supabaseUrl"
            placeholder="https://your-project.supabase.co"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Supabase Anon Key</label>
          <input
            v-model="settings.supabaseAnonKey"
            type="password"
            placeholder="Enter new key to update"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Authorized Email</label>
          <input
            v-model="settings.authorizedEmail"
            type="email"
            placeholder="you@example.com"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <!-- Advanced -->
      <div v-if="activeTab === 'advanced'" class="space-y-4 max-w-lg">
        <div class="flex items-center gap-3">
          <input v-model="settings.selfEditEnabled" type="checkbox" id="selfEdit" class="rounded" />
          <div>
            <label for="selfEdit" class="text-sm font-medium">Self-Edit Mode</label>
            <p class="text-xs text-muted-foreground">Allow IO to modify its own source code</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <input v-model="settings.watchdogEnabled" type="checkbox" id="watchdog" class="rounded" />
          <div>
            <label for="watchdog" class="text-sm font-medium">Watchdog</label>
            <p class="text-xs text-muted-foreground">Monitor event loop and zombie instances</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
