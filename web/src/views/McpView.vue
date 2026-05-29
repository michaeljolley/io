<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { apiGet, apiPut, apiDelete, apiPost } from "@/lib/api";
  import { Server, Plus, Trash2 } from "lucide-vue-next";
  import ToggleSwitch from "@/components/ToggleSwitch.vue";

  interface McpServer {
    id: string;
    name: string;
    type: "stdio" | "http";
    enabled: boolean;
    command?: string;
    url?: string;
    args?: string[];
    env?: Record<string, string>;
  }

  const servers = ref<McpServer[]>([]);
  const loading = ref(true);
  const showAdd = ref(false);
  const newServer = ref({
    name: "",
    type: "stdio" as "stdio" | "http",
    command: "",
    url: "",
    argsText: "",
    envText: "",
  });

  onMounted(async () => {
    try {
      servers.value = await apiGet("/mcp");
    } finally {
      loading.value = false;
    }
  });

  function parseArgs(raw: string): string[] {
    return raw
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function parseEnv(raw: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    try {
      const jsonCandidate = JSON.parse(raw);
      if (jsonCandidate && typeof jsonCandidate === "object" && !Array.isArray(jsonCandidate)) {
        for (const [key, value] of Object.entries(jsonCandidate)) {
          parsed[key] = String(value);
        }
        return parsed;
      }
    } catch {
      // Fall back to KEY=value parsing below.
    }

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key) {
        parsed[key] = value;
      }
    }

    return parsed;
  }

  async function toggleServer(server: McpServer) {
    await apiPut(`/mcp/${server.id}`, { enabled: !server.enabled });
    server.enabled = !server.enabled;
  }

  async function deleteServer(id: string) {
    await apiDelete(`/mcp/${id}`);
    servers.value = servers.value.filter((s) => s.id !== id);
  }

  async function addServer() {
    const body: any = {
      name: newServer.value.name,
      type: newServer.value.type,
      args: parseArgs(newServer.value.argsText),
      env: parseEnv(newServer.value.envText),
    };
    if (newServer.value.type === "stdio") body.command = newServer.value.command;
    else body.url = newServer.value.url;

    const server = await apiPost("/mcp", body);
    servers.value.push(server);
    showAdd.value = false;
    newServer.value = {
      name: "",
      type: "stdio",
      command: "",
      url: "",
      argsText: "",
      envText: "",
    };
  }
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-sm font-medium text-primary">MCP configuration</p>
        <h1 class="text-2xl font-bold">MCP Servers</h1>
      </div>
      <button @click="showAdd = !showAdd" class="btn-gradient inline-flex items-center gap-1">
        <Plus class="w-4 h-4" /> Add Server
      </button>
    </div>

    <div v-if="showAdd" class="border border-border rounded-lg p-4 mb-6 space-y-3 bg-card">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm font-medium">Name</label>
          <input
            v-model="newServer.name"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Type</label>
          <select
            v-model="newServer.type"
            class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </div>
      </div>
      <div v-if="newServer.type === 'stdio'">
        <label class="text-sm font-medium">Command</label>
        <input
          v-model="newServer.command"
          placeholder="npx @my/mcp-server"
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div v-else>
        <label class="text-sm font-medium">URL</label>
        <input
          v-model="newServer.url"
          placeholder="https://..."
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label class="text-sm font-medium">Command args</label>
        <textarea
          v-model="newServer.argsText"
          rows="3"
          placeholder="--stdio&#10;--figma-api-key=${FIGMA_API_KEY}"
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p class="mt-1 text-xs text-muted-foreground">Enter one arg per line or comma-separated.</p>
      </div>

      <div>
        <label class="text-sm font-medium">Environment variables</label>
        <textarea
          v-model="newServer.envText"
          rows="4"
          placeholder="FIGMA_API_KEY=${FIGMA_API_KEY}&#10;LOG_LEVEL=debug"
          class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          Use KEY=value lines, or paste JSON. Values like ${FIGMA_API_KEY} are preserved.
        </p>
      </div>

      <div class="flex justify-end">
        <button @click="addServer" class="btn-gradient">Save</button>
      </div>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="servers.length === 0" class="text-center py-12 text-muted-foreground">
      <Server class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No MCP servers configured.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="server in servers"
        :key="server.id"
        class="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-card"
      >
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">{{ server.name }}</span>
            <span class="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{{
              server.type
            }}</span>
          </div>
          <div v-if="server.command || server.url" class="text-xs text-muted-foreground">
            {{ server.command || server.url }}
          </div>
          <div v-if="server.args?.length" class="text-xs text-muted-foreground">
            Args: {{ server.args.join(", ") }}
          </div>
          <div
            v-if="server.env && Object.keys(server.env).length > 0"
            class="text-xs text-muted-foreground"
          >
            Env: {{ Object.keys(server.env).join(", ") }}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <ToggleSwitch
            :model-value="server.enabled"
            :aria-label="`Toggle ${server.name}`"
            @update:model-value="toggleServer(server)"
          />
          <button
            @click="deleteServer(server.id)"
            class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
