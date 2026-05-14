<template>
  <div class="flex flex-col h-full bg-gray-950">

    <!-- Skill detail panel -->
    <div v-if="selectedSkill" class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-800 shrink-0">
        <button
          @click="closeDetail"
          class="text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5 text-sm"
        >
          ← Back
        </button>
        <h2 class="text-lg font-bold text-gray-100 truncate">{{ selectedSkill.name }}</h2>
        <span class="text-xs text-gray-500 font-mono shrink-0">{{ selectedSkill.slug }}</span>
      </div>

      <div v-if="contentLoading" class="flex-1 flex items-center justify-center">
        <span class="text-sm text-gray-500">Loading…</span>
      </div>
      <div v-else-if="contentError" class="flex-1 p-6">
        <p class="text-sm text-red-400">{{ contentError }}</p>
      </div>
      <div v-else class="flex-1 overflow-y-auto p-6 skill-content text-sm text-gray-300 leading-relaxed">
        <!-- Frontmatter info card -->
        <div v-if="parsedFrontmatter" class="mb-6 bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div v-if="parsedFrontmatter.name" class="mb-2">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Name</p>
            <p class="text-base font-semibold text-gray-100">{{ parsedFrontmatter.name }}</p>
          </div>
          <div v-if="parsedFrontmatter.description" class="mb-2">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Description</p>
            <p class="text-sm text-gray-300">{{ parsedFrontmatter.description }}</p>
          </div>
          <div class="flex flex-wrap gap-6 mt-2">
            <div v-if="parsedFrontmatter.version">
              <p class="text-xs text-gray-500 uppercase tracking-wide">Version</p>
              <p class="text-sm text-gray-300 font-mono">{{ parsedFrontmatter.version }}</p>
            </div>
            <div v-if="parsedFrontmatter.author">
              <p class="text-xs text-gray-500 uppercase tracking-wide">Author</p>
              <p class="text-sm text-gray-300">{{ parsedFrontmatter.author }}</p>
            </div>
          </div>
          <!-- Remaining frontmatter fields -->
          <dl v-if="remainingFrontmatterFields.length > 0" class="mt-3 pt-3 border-t border-gray-800 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-baseline">
            <template v-for="[key, val] in remainingFrontmatterFields" :key="key">
              <dt class="text-xs text-gray-500 whitespace-nowrap">{{ key }}</dt>
              <dd class="text-xs text-gray-400 font-mono">{{ val }}</dd>
            </template>
          </dl>
        </div>
        <!-- Markdown body -->
        <div v-html="renderedBody"></div>
      </div>
    </div>

    <!-- Skills list -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <h2 class="text-2xl font-bold mb-6">Skills</h2>

      <!-- Discover Skills links -->
      <div class="flex items-center gap-4 mb-6">
        <span class="text-xs text-gray-500 uppercase tracking-wide shrink-0">Discover</span>
        <a
          href="https://github.com/github/awesome-copilot"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="w-4 h-4 fill-current" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
          awesome-copilot
        </a>
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="w-4 h-4 fill-current" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8c0 .93.16 1.82.46 2.65L5 8.5V7H3.5l-.07.01A6.492 6.492 0 0 0 1.5 8Zm6.5 6.5c.93 0 1.82-.17 2.65-.47L8.5 11H7v2.5c.17.01.33.01.5.01Zm-5.3-1.7c.56.4 1.19.7 1.87.88L5 11H3.5c.34.66.79 1.25 1.2 1.8ZM8.5 1.5V4H10l2.5 2.5c.02-.16.03-.33.03-.5A6.5 6.5 0 0 0 8.5 1.5Zm-1 0A6.5 6.5 0 0 0 1.97 6H3.5L6 3.5V1.53c-.51.1-1 .26-1.5.46V1.5ZM11 8.5l-2.5 2.5H10l1.88-1.88A6.47 6.47 0 0 0 11 8.5ZM6 6v4h4V6H6Z"/></svg>
          skills.sh
        </a>
      </div>

      <!-- Install form with URL / Paste tabs -->
      <div class="mb-6 max-w-2xl">
        <!-- Tab switcher -->
        <div class="flex gap-1 mb-3 border-b border-gray-800">
          <button
            type="button"
            @click="installTab = 'url'"
            class="px-3 py-1.5 text-sm rounded-t transition-colors"
            :class="installTab === 'url' ? 'bg-gray-800 text-gray-100 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'"
          >
            From URL
          </button>
          <button
            type="button"
            @click="installTab = 'paste'"
            class="px-3 py-1.5 text-sm rounded-t transition-colors"
            :class="installTab === 'paste' ? 'bg-gray-800 text-gray-100 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'"
          >
            Paste SKILL.md
          </button>
        </div>

        <!-- URL install tab -->
        <form v-if="installTab === 'url'" @submit.prevent="installSkill">
          <div class="flex gap-2">
            <input
              v-model="newRepoUrl"
              type="url"
              placeholder="https://github.com/owner/repo.git"
              aria-label="Git repository URL"
              :disabled="installing"
              class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              :disabled="installing || newRepoUrl.trim() === ''"
              class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm transition-colors whitespace-nowrap"
            >
              {{ installing ? 'Installing…' : 'Install' }}
            </button>
          </div>
        </form>

        <!-- Paste install tab -->
        <form v-else @submit.prevent="installPaste">
          <div class="flex flex-col gap-2">
            <div>
              <input
                v-model="pasteSlug"
                type="text"
                placeholder="my-skill"
                aria-label="Skill slug"
                :disabled="pasting"
                class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <p class="text-xs text-gray-600 mt-1">Unique identifier for this skill (lowercase, hyphens ok)</p>
            </div>
            <textarea
              v-model="pasteContent"
              placeholder="Paste SKILL.md content here…"
              aria-label="SKILL.md content"
              :disabled="pasting"
              rows="8"
              class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono resize-y"
            ></textarea>
            <button
              type="submit"
              :disabled="pasting || pasteSlug.trim() === '' || pasteContent.trim() === ''"
              class="self-end bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              {{ pasting ? 'Installing…' : 'Install' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Install feedback banners -->
      <div v-if="installSuccess" class="bg-green-900 text-green-100 p-4 rounded-lg mb-4">
        {{ installSuccess }}
      </div>
      <div v-if="installError" class="bg-red-900 text-red-100 p-4 rounded-lg mb-4">
        {{ installError }}
      </div>

      <!-- Search -->
      <div v-if="!loading && !error && skills.length > 0" class="mb-4 max-w-2xl">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search skills…"
          aria-label="Search skills"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <!-- List states -->
      <div v-if="loading" class="text-gray-400 text-center py-12">
        Loading skills...
      </div>
      <div v-else-if="error" class="bg-red-900 text-red-100 p-4 rounded-lg mb-4">
        {{ error }}
      </div>
      <div v-else-if="skills.length === 0" class="text-gray-400 text-center py-12">
        No skills available
      </div>

      <div v-else-if="filteredSkills.length === 0" class="text-gray-400 text-center py-12">
        No matching skills
      </div>

      <div v-else class="grid gap-4">
        <div
          v-for="skill in filteredSkills"
          :key="skill.slug"
          @click="openDetail(skill)"
          class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
        >
          <div class="flex justify-between items-start mb-2">
            <div class="min-w-0">
              <h3 class="font-bold text-gray-100">{{ skill.name }}</h3>
              <p class="text-sm text-gray-500">{{ skill.slug }}</p>
            </div>
            <button
              @click.stop="deleteSkill(skill)"
              class="shrink-0 ml-2 text-gray-600 hover:text-red-400 transition-colors text-sm p-1 rounded hover:bg-gray-700"
              title="Delete skill"
            >🗑️</button>
          </div>
          <p class="text-sm text-gray-400 mb-3">{{ skill.description }}</p>
          <p class="text-xs text-gray-500">{{ skill.path }}</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

<style scoped>
.skill-content :deep(h1),
.skill-content :deep(h2),
.skill-content :deep(h3),
.skill-content :deep(h4) {
  line-height: 1.3;
}
</style>
