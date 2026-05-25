<template>
  <div class="h-full p-5"><div class="h-full flex overflow-hidden bg-bg-card border border-border rounded-lg"><div class="w-64 shrink-0 border-r border-border bg-bg-surface flex flex-col overflow-hidden"><div class="p-3 border-b border-border space-y-2"><input v-model="searchQuery" placeholder="Search skills..." class="w-full bg-bg-elevated border border-border rounded-md px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none transition-colors" /></div><div class="p-3 border-b border-border space-y-2"><div class="flex items-center gap-2"><button @click="installTab = 'url'" class="text-[11px] transition-colors" :class="installTab === 'url' ? 'text-accent-cyan' : 'text-text-muted hover:text-text'">URL</button><span class="text-border-bright">|</span><button @click="installTab = 'paste'" class="text-[11px] transition-colors" :class="installTab === 'paste' ? 'text-accent-cyan' : 'text-text-muted hover:text-text'">Paste</button></div><template v-if="installTab === 'url'"><input v-model="newRepoUrl" placeholder="Git repo URL" class="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><button @click="installSkill" :disabled="installing || !newRepoUrl.trim()" class="text-[11px] px-2.5 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-40 transition-colors">{{ installing ? 'Installing...' : 'Install' }}</button></template><template v-else><input v-model="pasteSlug" placeholder="skill-slug" class="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-[11px] font-mono text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none" /><textarea v-model="pasteContent" placeholder="Paste markdown skill content..." rows="3" class="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:border-accent-cyan/40 outline-none resize-none"></textarea><button @click="installPaste" :disabled="pasting || !pasteSlug.trim() || !pasteContent.trim()" class="text-[11px] px-2.5 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-40 transition-colors">{{ pasting ? 'Installing...' : 'Install' }}</button></template><p v-if="installError" class="text-[10px] text-accent-red">{{ installError }}</p><p v-if="installSuccess" class="text-[10px] text-accent-green">{{ installSuccess }}</p></div><div class="flex-1 overflow-y-auto py-1"><div v-if="loading" class="px-4 py-3 text-text-muted text-xs">Loading...</div><div v-else-if="error" class="px-4 py-3 text-accent-red text-xs">{{ error }}</div><button v-for="skill in filteredSkills" :key="skill.slug" @click="openDetail(skill)" class="w-full text-left px-4 py-2.5 border-b border-border transition-colors" :class="selectedSkill?.slug === skill.slug ? 'bg-bg-elevated text-text border-l-2 border-l-accent-cyan' : 'text-text-muted hover:text-text hover:bg-bg-elevated/50 border-l-2 border-l-transparent'"><p class="text-xs font-medium truncate" :class="selectedSkill?.slug === skill.slug ? 'text-accent-cyan' : 'text-text'">{{ skill.name }}</p><p class="text-[10px] truncate mt-0.5">{{ skill.description }}</p></button><div v-if="!loading && !filteredSkills.length" class="px-4 py-3 text-text-muted text-xs">No skills found</div></div></div><div class="flex-1 overflow-y-auto p-5"><div v-if="!selectedSkill" class="h-full flex items-center justify-center text-text-muted text-sm">Select a skill to view details</div><template v-else><div class="flex items-start justify-between mb-5"><div><h2 class="text-base font-semibold text-text">{{ selectedSkill.name }}</h2><p class="text-xs font-mono text-text-muted mt-0.5">{{ selectedSkill.slug }}</p></div><div class="flex items-center gap-2"><button @click="deleteSkill(selectedSkill)" class="text-[11px] px-2.5 py-1 rounded border border-accent-red/30 text-accent-red hover:bg-accent-red/10 transition-colors">Delete</button><button @click="closeDetail" class="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-bg-elevated transition-colors"><svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg></button></div></div><div v-if="contentLoading" class="text-text-muted text-sm">Loading...</div><div v-else-if="contentError" class="text-accent-red text-sm">{{ contentError }}</div><template v-else><div v-if="parsedFrontmatter" class="bg-bg-card border border-border rounded-lg p-4 mb-5 space-y-1.5"><template v-for="key in PROMINENT_KEYS" :key="key"><div v-if="parsedFrontmatter[key]" class="text-xs"><span class="text-text-muted">{{ key }}:</span><span class="text-text-secondary"> {{ parsedFrontmatter[key] }}</span></div></template><div v-for="[k, v] in remainingFrontmatterFields" :key="k" class="text-xs"><span class="text-text-muted">{{ k }}:</span><span class="text-text-secondary"> {{ v }}</span></div></div><div class="wiki-content text-sm" v-html="renderedBody"></div></template></template></div></div></div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import { apiFetch } from '../lib/api'
import { renderMarkdown, extractFrontmatter } from '../lib/markdown'

interface Skill {
  name: string
  slug: string
  description: string
  path: string
}

const skills = ref<Skill[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newRepoUrl = ref<string>('')
const installing = ref(false)
const installError = ref<string | null>(null)
const installSuccess = ref<string | null>(null)

// Paste install state
const installTab = ref<'url' | 'paste'>('url')
const pasteSlug = ref<string>('')
const pasteContent = ref<string>('')
const pasting = ref(false)

// Detail panel state
const selectedSkill = ref<Skill | null>(null)
const skillContent = ref<string>('')
const contentLoading = ref(false)
const contentError = ref<string | null>(null)

const skillData = computed(() => extractFrontmatter(skillContent.value))
const parsedFrontmatter = computed(() => skillData.value.frontmatter)
const renderedBody = computed(() => renderMarkdown(skillData.value.body))

const PROMINENT_KEYS = ['name', 'description', 'version', 'author'] as const
const remainingFrontmatterFields = computed(() => {
  if (!parsedFrontmatter.value) return []
  return Object.entries(parsedFrontmatter.value).filter(([k]) => !(PROMINENT_KEYS as readonly string[]).includes(k))
})

const searchQuery = ref<string>('')

const filteredSkills = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return skills.value
  return skills.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.slug.toLowerCase().includes(q) ||
    (s.description ?? '').toLowerCase().includes(q)
  )
})

async function openDetail(skill: Skill) {
  selectedSkill.value = skill
  skillContent.value = ''
  contentError.value = null
  contentLoading.value = true
  try {
    const res = await apiFetch(`/api/skills/${encodeURIComponent(skill.slug)}`)
    if (res.status === 404) {
      contentError.value = 'Skill not found'
    } else if (!res.ok) {
      contentError.value = `Failed to load skill (HTTP ${res.status})`
    } else {
      const data = (await res.json()) as { slug: string; content: string }
      skillContent.value = data.content ?? ''
    }
  } catch (e) {
    contentError.value = e instanceof Error ? e.message : 'Failed to load skill'
  } finally {
    contentLoading.value = false
  }
}

function closeDetail() {
  selectedSkill.value = null
  skillContent.value = ''
  contentError.value = null
}

async function fetchSkills(): Promise<void> {
  try {
    const response = await apiFetch('/api/skills')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as { skills: Skill[] }
    skills.value = data.skills
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load skills'
  } finally {
    loading.value = false
  }
}

async function installSkill(): Promise<void> {
  if (installing.value || newRepoUrl.value.trim() === '') return
  installing.value = true
  installError.value = null
  installSuccess.value = null

  try {
    const response = await apiFetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: newRepoUrl.value.trim() }),
    })

    if (response.ok) {
      const data = (await response.json()) as { skill: Skill }
      skills.value = [data.skill, ...skills.value]
      newRepoUrl.value = ''
      installSuccess.value = `✓ Installed: ${data.skill.name}`
      setTimeout(() => { installSuccess.value = null }, 4000)
      void fetchSkills()
    } else {
      let message = 'Install failed'
      try {
        const body = (await response.json()) as { error?: string }
        message = body.error ?? response.statusText ?? message
      } catch {
        message = response.statusText || message
      }
      installError.value = message
    }
  } catch (e) {
    installError.value = e instanceof Error ? e.message : 'Install failed'
  } finally {
    installing.value = false
  }
}

async function installPaste(): Promise<void> {
  if (pasting.value || pasteSlug.value.trim() === '' || pasteContent.value.trim() === '') return
  pasting.value = true
  installError.value = null
  installSuccess.value = null

  try {
    const response = await apiFetch('/api/skills/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: pasteContent.value.trim(), slug: pasteSlug.value.trim() }),
    })

    if (response.ok) {
      const data = (await response.json()) as { skill: Skill }
      skills.value = [data.skill, ...skills.value]
      pasteSlug.value = ''
      pasteContent.value = ''
      installSuccess.value = `✓ Installed: ${data.skill.name}`
      setTimeout(() => { installSuccess.value = null }, 4000)
      void fetchSkills()
    } else {
      let message = 'Install failed'
      try {
        const body = (await response.json()) as { error?: string }
        message = body.error ?? response.statusText ?? message
      } catch {
        message = response.statusText || message
      }
      installError.value = message
    }
  } catch (e) {
    installError.value = e instanceof Error ? e.message : 'Install failed'
  } finally {
    pasting.value = false
  }
}

async function deleteSkill(skill: Skill): Promise<void> {
  if (!confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) return
  try {
    const res = await apiFetch(`/api/skills/${encodeURIComponent(skill.slug)}`, { method: 'DELETE' })
    if (res.ok) {
      skills.value = skills.value.filter(s => s.slug !== skill.slug)
      installSuccess.value = `✓ Deleted: ${skill.name}`
      setTimeout(() => { installSuccess.value = null }, 3000)
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string }
      installError.value = body.error ?? (res.status === 404 ? 'Skill not found' : `Delete failed (HTTP ${res.status})`)
    }
  } catch (e) {
    installError.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

onMounted(fetchSkills)
</script>
