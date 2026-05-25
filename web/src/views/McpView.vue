<template>
  <div class="flex flex-col h-full p-3 sm:p-6 overflow-y-auto">
    <!-- Header -->
    <div class="flex justify-between items-start mb-6">
      <div>
        <h2 class="text-xl font-bold text-txt-primary tracking-tight">MCP Servers</h2>
        <p class="text-xs text-txt-muted mt-0.5">Manage Model Context Protocol servers and their tools</p>
      </div>
      <button
        @click="reload"
        :disabled="reloading"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50 disabled:cursor-wait transition-all duration-150"
        title="Reload MCP tools (applies config changes)"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5" :class="reloading ? 'animate-spin' : ''" aria-hidden="true">
          <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39A5.5 5.5 0 0 1 13.89 5.05l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd"/>
        </svg>
        {{ reloading ? 'Reloading...' : 'Reload Tools' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-4 text-sm">
      <span>!</span> {{ error }}
    </div>
    <!-- Success -->
    <div v-if="successMsg" class="flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 p-3 rounded-lg mb-4 text-sm">
      <span>OK</span> {{ successMsg }}
    </div>

    <!-- Server list -->
    <div class="mb-6">
      <h3 class="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-3">Configured Servers</h3>

      <div v-if="loading" class="flex items-center gap-2 text-txt-muted text-sm py-4">
        <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
        Loading...
      </div>

      <div v-else-if="servers.length === 0" class="text-txt-muted text-sm py-4 text-center border border-dashed border-edge rounded-xl">
        No MCP servers configured. Add one below.
      </div>

      <ul v-else class="space-y-2">
        <li
          v-for="server in servers"
          :key="server.name"
          class="flex items-center gap-3 p-3 bg-surface-2/50 border border-edge rounded-xl hover:border-edge-bright transition-all duration-150 group"
          :class="server.enabled === false ? 'opacity-60' : ''"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="server.enabled === false ? 'bg-txt-muted' : 'bg-green-400'"></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-txt-primary">{{ server.name }}</span>
              <span class="text-[10px] font-mono text-txt-muted bg-surface-0/60 px-1.5 py-0.5 rounded border border-edge/50 shrink-0">
                {{ server.url ? 'SSE' : 'stdio' }}
              </span>
            </div>
            <p class="text-[11px] text-txt-muted font-mono truncate mt-0.5">
              {{ server.url ?? [server.command, ...(server.args ?? [])].join(' ') }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              @click="toggleServer(server.name)"
              :disabled="toggling.has(server.name)"
              class="px-2 py-1 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-40"
              :class="server.enabled === false ? 'text-txt-muted border-edge hover:text-txt-primary hover:border-edge-bright' : 'text-accent border-accent/30 hover:bg-accent/10'"
            >
              {{ server.enabled === false ? 'Enable' : 'Disable' }}
            </button>
            <button
              @click="deleteServer(server.name)"
              :disabled="deleting.has(server.name)"
              class="p-1.5 rounded-lg text-txt-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-40 transition-all duration-150"
              title="Remove server"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add Server form -->
    <div class="bg-surface-2/30 border border-edge rounded-xl p-4">
      <h3 class="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-4">Add Server</h3>
      <form @submit.prevent="addServer" class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-txt-secondary mb-1">Name *</label>
          <input v-model="form.name" type="text" placeholder="e.g. github, postgres"
            class="w-full bg-surface-2/50 border border-edge text-txt-primary text-sm rounded-lg px-3 py-2 placeholder:text-txt-muted focus:outline-none focus:border-accent/60 transition-colors" required />
        </div>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 text-sm text-txt-secondary cursor-pointer">
            <input v-model="form.transport" type="radio" value="stdio" class="accent-accent" /> stdio (command)
          </label>
          <label class="flex items-center gap-2 text-sm text-txt-secondary cursor-pointer">
            <input v-model="form.transport" type="radio" value="sse" class="accent-accent" /> SSE (URL)
          </label>
        </div>
        <template v-if="form.transport === 'stdio'">
          <div>
            <label class="block text-xs font-medium text-txt-secondary mb-1">Command *</label>
            <input v-model="form.command" type="text" placeholder="e.g. npx"
              class="w-full bg-surface-2/50 border border-edge text-txt-primary text-sm rounded-lg px-3 py-2 placeholder:text-txt-muted focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-medium text-txt-secondary mb-1">Args <span class="text-txt-muted font-normal">(space-separated)</span></label>
            <input v-model="form.args" type="text" placeholder="e.g. -y @modelcontextprotocol/server-github"
              class="w-full bg-surface-2/50 border border-edge text-txt-primary text-sm rounded-lg px-3 py-2 placeholder:text-txt-muted focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
        </template>
        <template v-if="form.transport === 'sse'">
          <div>
            <label class="block text-xs font-medium text-txt-secondary mb-1">URL *</label>
            <input v-model="form.url" type="url" placeholder="e.g. http://localhost:3001/sse"
              class="w-full bg-surface-2/50 border border-edge text-txt-primary text-sm rounded-lg px-3 py-2 placeholder:text-txt-muted focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
        </template>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium text-txt-secondary">Environment Variables</label>
            <button type="button" @click="addEnvRow" class="text-[11px] text-accent hover:text-accent/80 transition-colors">+ Add</button>
          </div>
          <div v-for="(row, i) in form.envRows" :key="i" class="flex gap-2 mb-1.5">
            <input v-model="row.key" type="text" placeholder="KEY"
              class="flex-1 bg-surface-2/50 border border-edge text-txt-primary text-xs rounded-lg px-2 py-1.5 placeholder:text-txt-muted font-mono focus:outline-none focus:border-accent/60 transition-colors" />
            <input v-model="row.value" type="text" placeholder="value"
              class="flex-1 bg-surface-2/50 border border-edge text-txt-primary text-xs rounded-lg px-2 py-1.5 placeholder:text-txt-muted font-mono focus:outline-none focus:border-accent/60 transition-colors" />
            <button type="button" @click="removeEnvRow(i)" class="text-txt-muted hover:text-red-400 transition-colors px-1">x</button>
          </div>
        </div>
        <button type="submit" :disabled="adding"
          class="px-4 py-2 bg-accent/10 border border-accent/30 text-accent text-sm font-medium rounded-lg hover:bg-accent/20 disabled:opacity-50 disabled:cursor-wait transition-all duration-150">
          {{ adding ? 'Adding...' : 'Add Server' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiFetch } from '../lib/api'

interface McpServer {
  name: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled?: boolean
}

const servers = ref<McpServer[]>([])
const loading = ref(false)
const reloading = ref(false)
const adding = ref(false)
const toggling = ref(new Set<string>())
const deleting = ref(new Set<string>())
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)

const form = ref({
  name: '',
  transport: 'stdio' as 'stdio' | 'sse',
  command: '',
  args: '',
  url: '',
  envRows: [] as { key: string; value: string }[],
})

function flash(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = null }, 3000)
}
function addEnvRow() { form.value.envRows.push({ key: '', value: '' }) }
function removeEnvRow(i: number) { form.value.envRows.splice(i, 1) }

async function fetchServers() {
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch('/api/mcp/servers')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { servers: McpServer[] }
    servers.value = data.servers ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load servers'
  } finally {
    loading.value = false
  }
}

async function toggleServer(name: string) {
  const next = new Set(toggling.value); next.add(name); toggling.value = next
  try {
    const res = await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}/toggle`, { method: 'PATCH' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { enabled: boolean }
    const srv = servers.value.find(s => s.name === name)
    if (srv) srv.enabled = data.enabled
    flash(`${name} ${data.enabled ? 'enabled' : 'disabled'} -- reload to apply`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Toggle failed'
  } finally {
    const n2 = new Set(toggling.value); n2.delete(name); toggling.value = n2
  }
}

async function deleteServer(name: string) {
  if (!window.confirm(`Remove MCP server "${name}"?`)) return
  const next = new Set(deleting.value); next.add(name); deleting.value = next
  try {
    const res = await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    servers.value = servers.value.filter(s => s.name !== name)
    flash(`${name} removed -- reload to apply`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    const n2 = new Set(deleting.value); n2.delete(name); deleting.value = n2
  }
}

async function addServer() {
  error.value = null
  adding.value = true
  try {
    const env: Record<string, string> = {}
    for (const row of form.value.envRows) {
      if (row.key.trim()) env[row.key.trim()] = row.value
    }
    const body: Record<string, unknown> = { name: form.value.name }
    if (form.value.transport === 'stdio') {
      body.command = form.value.command
      if (form.value.args.trim()) body.args = form.value.args.trim().split(/\s+/)
    } else {
      body.url = form.value.url
    }
    if (Object.keys(env).length) body.env = env
    const res = await apiFetch('/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json() as { error: string }
      throw new Error(data.error ?? `HTTP ${res.status}`)
    }
    form.value = { name: '', transport: 'stdio', command: '', args: '', url: '', envRows: [] }
    await fetchServers()
    flash('Server added -- reload to activate tools')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to add server'
  } finally {
    adding.value = false
  }
}

async function reload() {
  reloading.value = true
  error.value = null
  try {
    const res = await apiFetch('/api/mcp/reload', { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchServers()
    flash('MCP tools reloaded successfully')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Reload failed'
  } finally {
    reloading.value = false
  }
}

onMounted(fetchServers)
</script>
