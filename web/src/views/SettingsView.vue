<script setup lang="ts">
import { ref } from "vue";

const activeTab = ref("general");

const tabs = [
  { id: "general", label: "General" },
  { id: "telegram", label: "Telegram" },
  { id: "auth", label: "Auth" },
  { id: "models", label: "Models" },
  { id: "advanced", label: "Advanced" },
];
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- General -->
    <div v-if="activeTab === 'general'" class="space-y-4 max-w-lg">
      <div>
        <label class="text-sm font-medium">Default Model</label>
        <input value="gpt-4.1" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Port</label>
        <input type="number" value="3170" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Background Notify Mode</label>
        <select class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="meaningful" selected>Meaningful</option>
          <option value="off">Off</option>
        </select>
      </div>
    </div>

    <!-- Telegram -->
    <div v-if="activeTab === 'telegram'" class="space-y-4 max-w-lg">
      <div>
        <label class="text-sm font-medium">Bot Token</label>
        <input type="password" placeholder="••••••••" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Authorized User ID</label>
        <input type="number" placeholder="123456789" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium">Enable Telegram</label>
        <button class="relative w-10 h-5 rounded-full bg-muted">
          <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white"></span>
        </button>
      </div>
    </div>

    <!-- Auth -->
    <div v-if="activeTab === 'auth'" class="space-y-4 max-w-lg">
      <div>
        <label class="text-sm font-medium">Supabase URL</label>
        <input placeholder="https://your-project.supabase.co" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Supabase Anon Key</label>
        <input type="password" placeholder="••••••••" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Authorized Email</label>
        <input type="email" placeholder="you@example.com" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
    </div>

    <!-- Models -->
    <div v-if="activeTab === 'models'" class="space-y-4 max-w-lg">
      <div>
        <label class="text-sm font-medium">High Tier</label>
        <p class="text-xs text-muted-foreground mb-1">Complex tasks (architecture, debugging)</p>
        <input value="claude-opus-4.7, claude-opus-4.6" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Medium Tier</label>
        <p class="text-xs text-muted-foreground mb-1">Standard tasks (features, tests)</p>
        <input value="claude-sonnet-4.6, gpt-5.5, claude-opus-4.5" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Low Tier</label>
        <p class="text-xs text-muted-foreground mb-1">Simple tasks (reads, formatting)</p>
        <input value="claude-haiku-4.5, gpt-5.4-mini" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
    </div>

    <!-- Advanced -->
    <div v-if="activeTab === 'advanced'" class="space-y-4 max-w-lg">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium">Self-Edit Mode</label>
          <p class="text-xs text-muted-foreground">Allow IO to modify its own source code</p>
        </div>
        <button class="relative w-10 h-5 rounded-full bg-muted">
          <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white"></span>
        </button>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium">Watchdog</label>
          <p class="text-xs text-muted-foreground">Monitor event loop and zombie instances</p>
        </div>
        <button class="relative w-10 h-5 rounded-full bg-primary">
          <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white translate-x-5"></span>
        </button>
      </div>
    </div>
  </div>
</template>
