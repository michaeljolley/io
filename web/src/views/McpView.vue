<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGet, apiPut, apiDelete, apiPost } from "@/lib/api";
import { Server, Plus, Trash2 } from "lucide-vue-next";

interface McpServer {
  id: string;
  name: string;
  type: "stdio" | "http";
  enabled: boolean;
}

const servers = ref<McpServer[]>([]);
const loading = ref(true);
const showAdd = ref(false);
const newServer = ref({ name: "", type: "stdio" as "stdio" | "http", command: "", url: "" });

onMounted(async () => {
  try {
    servers.value = await apiGet("/mcp");
  } finally {
    loading.value = false;
  }
});

async function toggleServer(server: McpServer) {
  await apiPut(`/mcp/${server.id}`, { enabled: !server.enabled });
  server.enabled = !server.enabled;
}

async function deleteServer(id: string) {
  await apiDelete(`/mcp/${id}`);
  servers.value = servers.value.filter((s) => s.id !== id);
}

async function addServer() {
  const body: any = { name: newServer.value.name, type: newServer.value.type };
  if (newServer.value.type === "stdio") body.command = newServer.value.command;
  else body.url = newServer.value.url;
  const server = await apiPost("/mcp", body);
  servers.value.push(server);
  showAdd.value = false;
  newServer.value = { name: "", type: "stdio", command: "", url: "" };
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">MCP Servers</h1>
      <button
        @click="showAdd = !showAdd"
        class="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus class="w-4 h-4" /> Add Server
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showAdd" class="border border-border rounded-lg p-4 mb-6 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm font-medium">Name</label>
          <input v-model="newServer.name" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-sm font-medium">Type</label>
          <select v-model="newServer.type" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </div>
      </div>
      <div v-if="newServer.type === 'stdio'">
        <label class="text-sm font-medium">Command</label>
        <input v-model="newServer.command" placeholder="npx @my/mcp-server" class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div v-else>
        <label class="text-sm font-medium">URL</label>
        <input v-model="newServer.url" placeholder="https://..." class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <button @click="addServer" class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <div v-else-if="servers.length === 0" class="text-center py-12 text-muted-foreground">
      <Server class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>No MCP servers configured.</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="server in servers" :key="server.id" class="flex items-center justify-between border border-border rounded-lg px-4 py-3">
        <div>
          <span class="font-medium text-sm">{{ server.name }}</span>
          <span class="ml-2 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{{ server.type }}</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="toggleServer(server)"
            class="relative w-10 h-5 rounded-full transition-colors"
            :class="server.enabled ? 'bg-primary' : 'bg-muted'"
          >
            <span
              class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
              :class="server.enabled ? 'translate-x-5' : 'translate-x-0.5'"
            ></span>
          </button>
          <button @click="deleteServer(server.id)" class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
