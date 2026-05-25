<template>
  <div class="p-5 space-y-5">
    <div class="flex items-center justify-between"><h1 class="text-base font-semibold text-text">MCP Servers</h1><button @click="reload" :disabled="reloading" class="text-xs px-2.5 py-1 rounded-md border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-50 transition-colors">{{ reloading ? 'Reloading...' : 'Reload tools' }}</button></div>
    <p v-if="successMsg" class="text-xs text-accent-green">{{ successMsg }}</p>
    <p v-if="error" class="text-xs text-accent-red">{{ error }}</p>
    <div v-if="loading" class="text-text-muted text-sm py-4 text-center">Loading...</div>
    <div v-else-if="!servers.length" class="text-text-muted text-sm py-8 text-center">No MCP servers configured</div>
    <div v-else class="space-y-2">
      <div v-for="srv in servers" :key="srv.name" class="bg-bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0"><span :class="srv.enabled !== false ? 'bg-accent-green' : 'bg-text-muted/40'" class="w-2 h-2 rounded-full shrink-0"></span><div class="min-w-0"><p class="text-sm text-text font-medium">{{ srv.name }}</p><p class="text-[11px] text-text-muted font-mono truncate">{{ srv.command ? `${srv.command} ${(srv.args || []).join(' ')}` : srv.url ?? '' }}</p></div></div>
        <div class="flex items-center gap-1.5 shrink-0"><button @click="toggleServer(srv.name)" :disabled="toggling.has(srv.name)" class="text-[11px] px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-elevated disabled:opacity-40 transition-colors">{{ srv.enabled !== false ? 'Disable' : 'Enable' }}</button><button @click="deleteServer(srv.name)" :disabled="deleting.has(srv.name)" class="text-[11px] px-2 py-1 rounded border border-accent-red/30 text-accent-red hover:bg-accent-red/10 disabled:opacity-40 transition-colors">Remove</button></div>
      </div>
    </div>
    <div class="bg-bg-card border border-border rounded-lg p-4 space-y-3">
      <h2 class="text-xs text-text-muted uppercase tracking-wider">Add Server</h2>
      <div class="grid sm:grid-cols-2 gap-3"><input v-model="form.name" placeholder="Server name" class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /><select v-model="form.transport" class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent-cyan/40 outline-none transition-colors"><option value="stdio">stdio</option><option value="sse">SSE</option></select></div>
      <template v-if="form.transport === 'stdio'"><input v-model="form.command" placeholder="Command (e.g. npx)" class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /><input v-model="form.args" placeholder="Arguments (space-separated)" class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /></template>
      <template v-else><input v-model="form.url" placeholder="SSE URL" class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /></template>
      <div v-for="(row, i) in form.envRows" :key="i" class="flex gap-2"><input v-model="row.key" placeholder="KEY" class="flex-1 bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs font-mono text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><input v-model="row.value" placeholder="value" class="flex-1 bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs font-mono text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><button @click="removeEnvRow(i)" class="text-text-muted hover:text-accent-red text-sm w-6">×</button></div>
      <button @click="addEnvRow" class="text-[11px] text-text-muted hover:text-text transition-colors">+ Add env var</button>
      <button @click="addServer" :disabled="adding || !form.name.trim()" class="text-xs px-3 py-1.5 rounded-md bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-50 transition-colors">{{ adding ? 'Adding...' : 'Add Server' }}</button>
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
