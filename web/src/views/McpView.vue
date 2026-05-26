<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type McpServer = {
  name: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled?: boolean
}

const servers = ref<McpServer[]>([])
const form = ref({ name: '', command: '', url: '', args: '[]', env: '{}' })
const error = ref('')

function parseArgs(raw: string) {
  const value = raw.trim()
  if (!value) return undefined
  if (value.startsWith('[')) {
    return JSON.parse(value) as string[]
  }
  return value.split(/\s+/).filter(Boolean)
}

function parseEnv(raw: string) {
  const value = raw.trim()
  if (!value) return undefined
  if (value.startsWith('{')) {
    return JSON.parse(value) as Record<string, string>
  }
  return Object.fromEntries(value.split('\n').filter(Boolean).map((line) => {
    const [key, ...rest] = line.split('=')
    return [key, rest.join('=')]
  }))
}

async function loadServers() {
  const response = await apiFetch('/api/mcp/servers')
  if (response.ok) {
    servers.value = (await response.json() as { servers: McpServer[] }).servers
  }
}

async function createServer() {
  error.value = ''
  try {
    const payload: Record<string, unknown> = {
      name: form.value.name.trim(),
    }
    if (form.value.command.trim()) payload.command = form.value.command.trim()
    if (form.value.url.trim()) payload.url = form.value.url.trim()
    const args = parseArgs(form.value.args)
    const env = parseEnv(form.value.env)
    if (args) payload.args = args
    if (env) payload.env = env

    await apiFetch('/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    form.value = { name: '', command: '', url: '', args: '[]', env: '{}' }
    await loadServers()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid MCP payload.'
  }
}

async function toggleServer(name: string, enabled: boolean) {
  await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !enabled }),
  })
  await loadServers()
}

async function deleteServer(name: string) {
  await apiFetch(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
  await loadServers()
}

async function reloadServers() {
  await apiFetch('/api/mcp/reload', { method: 'POST' })
  await loadServers()
}

onMounted(loadServers)
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section class="min-h-0 overflow-y-auto rounded-[28px] border border-line bg-[#09090d]/96 p-4">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">server dashboard</div>
          <div class="mt-2 text-2xl font-semibold text-white">{{ servers.length }} registered transports</div>
        </div>
        <button class="rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan" @click="reloadServers">reload</button>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <article v-for="server in servers" :key="server.name" class="rounded-[26px] border border-line bg-surface/90 p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-white">{{ server.name }}</div>
              <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em]" :class="server.enabled ? 'text-success' : 'text-mist'">
                {{ server.enabled ? 'enabled' : 'disabled' }}
              </div>
            </div>
            <button class="rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" :class="server.enabled ? 'border-success/40 text-success' : 'border-line text-mist'" @click="toggleServer(server.name, !!server.enabled)">
              {{ server.enabled ? 'on' : 'off' }}
            </button>
          </div>
          <dl class="mt-4 space-y-3 font-mono text-xs text-slate-300">
            <div>
              <dt class="text-mist">command</dt>
              <dd class="mt-1 break-all">{{ server.command ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-mist">url</dt>
              <dd class="mt-1 break-all">{{ server.url ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-mist">args</dt>
              <dd class="mt-1 break-all">{{ server.args?.join(' ') ?? '—' }}</dd>
            </div>
          </dl>
          <button class="mt-5 rounded-2xl border border-danger/40 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-danger" @click="deleteServer(server.name)">delete server</button>
        </article>
      </div>
    </section>

    <section class="rounded-[28px] border border-violet/35 bg-surface/95 p-5 shadow-violet">
      <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">add server</div>
      <div class="mt-4 space-y-3">
        <input v-model="form.name" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="server name" />
        <input v-model="form.command" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="command (optional if URL transport)" />
        <input v-model="form.url" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="url (optional)" />
        <textarea v-model="form.args" rows="4" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-sm text-white" placeholder='["--stdio"] or --stdio' />
        <textarea v-model="form.env" rows="4" class="focus-ring w-full rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-sm text-white" placeholder='{"TOKEN":"..."} or KEY=value' />
        <div v-if="error" class="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{{ error }}</div>
        <button class="w-full rounded-2xl border border-violet/40 bg-violet/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-violet" @click="createServer">register server</button>
      </div>
    </section>
  </div>
</template>
