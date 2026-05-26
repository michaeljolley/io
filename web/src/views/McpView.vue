<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import SettingsTabs from '@/components/SettingsTabs.vue'
import { apiFetch } from '@/lib/api'

type McpServer = {
  name: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled?: boolean
  tools?: string[]
}

const servers = ref<McpServer[]>([])
const addingServer = ref(false)
const newServer = ref({ name: '', transport: 'stdio', command: '' })
const error = ref('')

function serverStatus(server: McpServer) {
  return server.enabled === false ? 'disabled' : 'connected'
}

function serverTools(server: McpServer) {
  if (server.tools?.length) return server.tools
  if (server.args?.length) return server.args
  return []
}

async function loadServers() {
  const response = await apiFetch('/api/mcp/servers')
  if (!response.ok) return
  servers.value = (await response.json() as { servers: McpServer[] }).servers
}

async function addServer() {
  error.value = ''
  if (!newServer.value.name.trim() || !newServer.value.command.trim()) return
  const payload: Record<string, string> = { name: newServer.value.name.trim() }
  if (newServer.value.transport === 'stdio') {
    payload.command = newServer.value.command.trim()
  } else {
    payload.url = newServer.value.command.trim()
  }
  const response = await apiFetch('/api/mcp/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    error.value = await response.text() || 'Unable to add server.'
    return
  }
  newServer.value = { name: '', transport: 'stdio', command: '' }
  addingServer.value = false
  await loadServers()
}

async function removeServer(name: string) {
  await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
  await loadServers()
}

async function toggleServer(name: string, enabled: boolean) {
  await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !enabled }),
  })
  await loadServers()
}

onMounted(loadServers)
</script>

<template>
  <SettingsTabs active="mcp">
    <div class="max-w-2xl space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">MCP servers extend IO agents with additional tools and data sources.</p>
        <button class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary" @click="addingServer = !addingServer">
          <AppIcon name="plus" class="h-3 w-3" />
          Add server
        </button>
      </div>

      <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
        <form v-if="addingServer" class="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-4" @submit.prevent="addServer">
          <div class="mb-1 font-mono text-xs text-primary/80">New MCP Server</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Name</label>
              <input v-model="newServer.name" class="w-full rounded border border-border bg-black/30 px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/30" placeholder="My Server" />
            </div>
            <div>
              <label class="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Transport</label>
              <select v-model="newServer.transport" class="w-full rounded border border-border bg-black/30 px-3 py-1.5 text-xs font-mono">
                <option value="stdio">stdio</option>
                <option value="http">HTTP/SSE</option>
              </select>
            </div>
          </div>
          <div>
            <label class="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">{{ newServer.transport === 'stdio' ? 'Command' : 'URL' }}</label>
            <input v-model="newServer.command" class="w-full rounded border border-border bg-black/30 px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/30" :placeholder="newServer.transport === 'stdio' ? 'npx @modelcontextprotocol/server-...' : 'https://...'
            " />
          </div>
          <div v-if="error" class="rounded border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ error }}</div>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground" @click="addingServer = false">Cancel</button>
            <button type="submit" class="rounded bg-primary/15 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:bg-primary/25">Add</button>
          </div>
        </form>
      </transition>

      <div class="space-y-2">
        <article v-for="server in servers" :key="server.name" class="overflow-hidden rounded-lg border border-border bg-card">
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="h-2 w-2 shrink-0 rounded-full" :class="serverStatus(server) === 'connected' ? 'bg-status-success' : 'bg-destructive'" :style="{ boxShadow: serverStatus(server) === 'connected' ? 'var(--glow-success)' : 'var(--glow-error)' }" />
            <div class="min-w-0 flex-1">
              <div class="mb-0.5 flex items-center gap-2">
                <span class="text-sm font-medium">{{ server.name }}</span>
                <span class="rounded px-1.5 py-0.5 font-mono text-[10px]" :class="serverStatus(server) === 'connected' ? 'bg-status-success/10 text-status-success' : 'bg-destructive/10 text-destructive'">{{ serverStatus(server) }}</span>
                <span class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ server.url ? 'http' : 'stdio' }}</span>
              </div>
              <code class="block truncate font-mono text-[11px] text-muted-foreground/50">{{ server.command ?? server.url ?? '—' }}</code>
            </div>
            <button class="rounded border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" @click="toggleServer(server.name, !!server.enabled)">{{ server.enabled === false ? 'enable' : 'disable' }}</button>
            <button class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive" @click="removeServer(server.name)">
              <AppIcon name="trash" class="h-3.5 w-3.5" />
            </button>
          </div>
          <div v-if="serverTools(server).length" class="flex flex-wrap gap-1.5 border-t border-border/40 px-4 py-2">
            <code v-for="tool in serverTools(server)" :key="tool" class="rounded border border-white/[0.05] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-foreground/50">{{ tool }}</code>
          </div>
        </article>
      </div>
    </div>
  </SettingsTabs>
</template>
