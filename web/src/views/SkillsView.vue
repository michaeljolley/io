<template>
  <div class="flex flex-col h-full bg-surface-0">

    <!-- ═══ Skill detail panel ═══ -->
    <div v-if="selectedSkill" class="flex flex-col h-full overflow-hidden animate-fade-in">
      <div class="flex items-center gap-3 px-3 sm:px-6 py-3.5 border-b border-edge/70 shrink-0 backdrop-blur-sm" style="background: linear-gradient(180deg, rgba(19,27,46,0.9) 0%, rgba(12,18,32,0.85) 100%)">
        <button
          @click="closeDetail"
          class="text-txt-muted hover:text-accent transition-colors flex items-center gap-1.5 text-sm group"
        >
          <FluentIcon paths="<path d="M12.35 15.85a.5.5 0 0 1-.7 0L6.16 10.4a.55.55 0 0 1 0-.78l5.49-5.46a.5.5 0 1 1 .7.7L7.2 10l5.16 5.15c.2.2.2.5 0 .7Z"/>" :size="14" class="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div class="w-px h-5 bg-edge"></div>
        <h2 class="text-base font-semibold text-txt-primary truncate">{{ selectedSkill.name }}</h2>
        <span class="text-[11px] text-txt-muted font-mono shrink-0 bg-surface-2/60 px-1.5 py-0.5 rounded">{{ selectedSkill.slug }}</span>
      </div>

      <div v-if="contentLoading" class="flex-1 flex items-center justify-center">
        <div class="flex items-center gap-2 text-txt-muted text-sm">
          <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
          Loading…
        </div>
      </div>
      <div v-else-if="contentError" class="flex-1 p-6">
        <div class="inline-flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span>⚠</span> {{ contentError }}
        </div>
      </div>
      <div v-else class="flex-1 overflow-y-auto p-6 skill-content text-sm text-txt-secondary leading-relaxed">
        <!-- Frontmatter info card -->
        <div v-if="parsedFrontmatter" class="mb-6 bg-surface-2/60 border border-edge rounded-xl p-5">
          <div v-if="parsedFrontmatter.name" class="mb-3">
            <p class="text-[10px] text-txt-muted uppercase tracking-widest mb-0.5">Name</p>
            <p class="text-base font-semibold text-txt-primary">{{ parsedFrontmatter.name }}</p>
          </div>
          <div v-if="parsedFrontmatter.description" class="mb-3">
            <p class="text-[10px] text-txt-muted uppercase tracking-widest mb-0.5">Description</p>
            <p class="text-sm text-txt-secondary">{{ parsedFrontmatter.description }}</p>
          </div>
          <div class="flex flex-wrap gap-6 mt-1">
            <div v-if="parsedFrontmatter.version">
              <p class="text-[10px] text-txt-muted uppercase tracking-widest mb-0.5">Version</p>
              <p class="text-sm text-accent font-mono">{{ parsedFrontmatter.version }}</p>
            </div>
            <div v-if="parsedFrontmatter.author">
              <p class="text-[10px] text-txt-muted uppercase tracking-widest mb-0.5">Author</p>
              <p class="text-sm text-txt-secondary">{{ parsedFrontmatter.author }}</p>
            </div>
          </div>
          <dl v-if="remainingFrontmatterFields.length > 0" class="mt-3 pt-3 border-t border-edge grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-baseline">
            <template v-for="[key, val] in remainingFrontmatterFields" :key="key">
              <dt class="text-[10px] text-txt-muted uppercase tracking-wider whitespace-nowrap">{{ key }}</dt>
              <dd class="text-xs text-txt-secondary font-mono">{{ val }}</dd>
            </template>
          </dl>
        </div>
        <div v-html="renderedBody"></div>
      </div>
    </div>

    <!-- ═══ Skills list ═══ -->
    <div v-else class="flex-1 overflow-y-auto p-3 sm:p-6">
      <div class="max-w-3xl">
        <div class="flex items-end justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-txt-primary tracking-tight">Skills</h2>
            <p class="text-xs text-txt-muted mt-0.5">Manage installed Copilot skills</p>
          </div>
          <!-- Discover links as accent pills -->
          <div class="flex items-center gap-2">
            <a
              href="https://github.com/github/awesome-copilot"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-xs text-txt-muted bg-surface-2/50 border border-edge
                     px-2.5 py-1 rounded-full hover:border-accent/30 hover:text-accent transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="w-3 h-3 fill-current" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
              awesome-copilot
            </a>
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-xs text-txt-muted bg-surface-2/50 border border-edge
                     px-2.5 py-1 rounded-full hover:border-accent/30 hover:text-accent transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="w-3 h-3 fill-current" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8c0 .93.16 1.82.46 2.65L5 8.5V7H3.5l-.07.01A6.492 6.492 0 0 0 1.5 8Zm6.5 6.5c.93 0 1.82-.17 2.65-.47L8.5 11H7v2.5c.17.01.33.01.5.01Zm-5.3-1.7c.56.4 1.19.7 1.87.88L5 11H3.5c.34.66.79 1.25 1.2 1.8ZM8.5 1.5V4H10l2.5 2.5c.02-.16.03-.33.03-.5A6.5 6.5 0 0 0 8.5 1.5Zm-1 0A6.5 6.5 0 0 0 1.97 6H3.5L6 3.5V1.53c-.51.1-1 .26-1.5.46V1.5ZM11 8.5l-2.5 2.5H10l1.88-1.88A6.47 6.47 0 0 0 11 8.5ZM6 6v4h4V6H6Z"/></svg>
              skills.sh
            </a>
          </div>
        </div>

        <!-- ── Install form ── -->
        <div class="mb-6 bg-surface-2/40 border border-edge rounded-xl p-4">
          <!-- Tab switcher -->
          <div class="flex gap-1 mb-3">
            <button
              type="button"
              @click="installTab = 'url'"
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150"
              :class="installTab === 'url'
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-txt-muted hover:text-txt-secondary hover:bg-surface-3/40 border border-transparent'"
            >
              From URL
            </button>
            <button
              type="button"
              @click="installTab = 'paste'"
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150"
              :class="installTab === 'paste'
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-txt-muted hover:text-txt-secondary hover:bg-surface-3/40 border border-transparent'"
            >
              Paste SKILL.md
            </button>
          </div>

          <!-- URL tab -->
          <form v-if="installTab === 'url'" @submit.prevent="installSkill">
            <div class="flex gap-2">
              <input
                v-model="newRepoUrl"
                type="url"
                placeholder="https://github.com/owner/repo.git"
                aria-label="Git repository URL"
                :disabled="installing"
                class="flex-1 bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                       placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                       disabled:opacity-40 transition-all duration-200"
              />
              <button
                type="submit"
                :disabled="installing || newRepoUrl.trim() === ''"
                class="bg-accent/15 text-accent border border-accent/25 px-4 py-2 rounded-lg text-sm font-medium
                       hover:bg-accent/25 hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-150 whitespace-nowrap"
              >
                {{ installing ? 'Installing…' : 'Install' }}
              </button>
            </div>
          </form>

          <!-- Paste tab -->
          <form v-else @submit.prevent="installPaste">
            <div class="flex flex-col gap-2">
              <div>
                <input
                  v-model="pasteSlug"
                  type="text"
                  placeholder="my-skill"
                  aria-label="Skill slug"
                  :disabled="pasting"
                  class="w-full bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                         placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                         disabled:opacity-40 transition-all duration-200"
                />
                <p class="text-[10px] text-txt-muted mt-1 ml-1">Unique identifier (lowercase, hyphens ok)</p>
              </div>
              <textarea
                v-model="pasteContent"
                placeholder="Paste SKILL.md content here…"
                aria-label="SKILL.md content"
                :disabled="pasting"
                rows="6"
                class="w-full bg-surface-1/80 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary font-mono
                       placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                       disabled:opacity-40 resize-y transition-all duration-200"
              ></textarea>
              <button
                type="submit"
                :disabled="pasting || pasteSlug.trim() === '' || pasteContent.trim() === ''"
                class="self-end bg-accent/15 text-accent border border-accent/25 px-4 py-2 rounded-lg text-sm font-medium
                       hover:bg-accent/25 hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-150"
              >
                {{ pasting ? 'Installing…' : 'Install' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Feedback banners -->
        <div v-if="installSuccess" class="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-3 rounded-lg mb-4 text-sm animate-fade-in">
          <span>✓</span> {{ installSuccess }}
        </div>
        <div v-if="installError" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-4 text-sm animate-fade-in">
          <span>⚠</span> {{ installError }}
        </div>

        <!-- Search -->
        <div v-if="!loading && !error && skills.length > 0" class="mb-4">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search skills…"
            aria-label="Search skills"
            class="w-full bg-surface-2/50 border border-edge rounded-lg px-3 py-2 text-sm text-txt-primary
                   placeholder-txt-muted/50 focus:outline-none focus:border-accent/40 focus:shadow-glow-sm
                   transition-all duration-200"
          />
        </div>

        <!-- List states -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div class="flex items-center gap-2 text-txt-muted text-sm">
            <span class="w-4 h-4 border-2 border-edge border-t-accent rounded-full animate-spin"></span>
            Loading skills…
          </div>
        </div>
        <div v-else-if="error" class="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg mb-4 text-sm">
          <span>⚠</span> {{ error }}
        </div>
        <div v-else-if="skills.length === 0" class="text-txt-muted text-sm text-center py-16">
          No skills installed yet
        </div>
        <div v-else-if="filteredSkills.length === 0" class="text-txt-muted text-sm text-center py-12">
          No matching skills
        </div>

        <!-- Skill cards grid -->
        <div v-else class="grid gap-3">
          <div
            v-for="skill in filteredSkills"
            :key="skill.slug"
            @click="openDetail(skill)"
            class="group bg-surface-2/40 border border-edge rounded-xl p-4
                   hover:border-edge-bright hover:shadow-card-hover hover:bg-surface-2/70
                   transition-all duration-200 cursor-pointer"
          >
            <div class="flex justify-between items-start mb-1.5">
              <div class="min-w-0">
                <h3 class="font-semibold text-txt-primary text-sm group-hover:text-accent transition-colors duration-150">{{ skill.name }}</h3>
                <p class="text-[11px] text-txt-muted font-mono mt-0.5">{{ skill.slug }}</p>
              </div>
              <button
                @click.stop="deleteSkill(skill)"
                class="shrink-0 ml-2 p-1.5 rounded-lg text-txt-muted/0 group-hover:text-txt-muted
                       hover:!text-red-400 hover:bg-red-500/10 transition-all duration-150"
                title="Delete skill"
              >
                <FluentIcon paths="<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>" :size="14" />
              </button>
            </div>
            <p class="text-xs text-txt-secondary mb-2 line-clamp-2">{{ skill.description }}</p>
            <p class="text-[10px] text-txt-muted font-mono truncate">{{ skill.path }}</p>
          </div>
        </div>
      </div>
    </div>

  </div>
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

<style scoped>
.skill-content :deep(h1),
.skill-content :deep(h2),
.skill-content :deep(h3),
.skill-content :deep(h4) {
  line-height: 1.3;
}
.skill-content :deep(pre) {
  font-family: 'JetBrains Mono', monospace;
  background: #060a13;
  border-color: #1e2d4a;
  border-radius: 0.625rem;
}
.skill-content :deep(code) {
  font-family: 'JetBrains Mono', monospace;
}
.skill-content :deep(a) {
  color: #22d3ee;
}
</style>
