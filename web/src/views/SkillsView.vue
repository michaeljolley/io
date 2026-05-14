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
      <div
        v-else
        class="flex-1 overflow-y-auto p-6 skill-content text-sm text-gray-300 leading-relaxed"
        v-html="renderedContent"
      ></div>
    </div>

    <!-- Skills list -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <h2 class="text-2xl font-bold mb-6">Skills</h2>

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

      <div v-else class="grid gap-4">
        <div
          v-for="skill in skills"
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
import { renderMarkdown } from '../lib/markdown'

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

const renderedContent = computed(() => renderMarkdown(skillContent.value))

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
