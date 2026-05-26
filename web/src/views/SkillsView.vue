<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SettingsTabs from '@/components/SettingsTabs.vue'
import SkillEditModal from '@/components/SkillEditModal.vue'
import SkillDeleteConfirmation from '@/components/SkillDeleteConfirmation.vue'
import AppIcon from '@/components/AppIcon.vue'
import { apiFetch } from '@/lib/api'
import { categorizeSkill } from '@/lib/mission-control'

type SkillSummary = {
  name: string
  slug: string
  description: string
  path: string
}

type SkillDetail = {
  name: string
  slug: string
  description: string
  path: string
  content: string
}

const categoryColors: Record<string, string> = {
  'File System': '#00d9ff',
  'Code Intelligence': '#5fff87',
  'Git & CI': '#c4a7ff',
  Communication: '#ffd000',
}

const skills = ref<SkillSummary[]>([])
const enabled = ref<Record<string, boolean>>({})
const expandedSkillSlug = ref<string | null>(null)
const selectedSkill = ref<SkillDetail | null>(null)

const editModalOpen = ref(false)
const deleteConfirmOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')

const groupedSkills = computed(() => {
  const map = new Map<string, SkillSummary[]>()
  for (const skill of skills.value) {
    const category = categorizeSkill(skill.name, skill.path)
    map.set(category, [...(map.get(category) ?? []), skill])
  }
  return [...map.entries()]
})

async function loadSkills() {
  const response = await apiFetch('/api/skills')
  if (!response.ok) return
  skills.value = (await response.json() as { skills: SkillSummary[] }).skills
  enabled.value = Object.fromEntries(skills.value.map((skill) => [skill.slug, enabled.value[skill.slug] ?? true]))
}

async function expandSkill(slug: string) {
  if (expandedSkillSlug.value === slug) {
    expandedSkillSlug.value = null
    selectedSkill.value = null
  } else {
    expandedSkillSlug.value = slug
    // Load full skill content
    const response = await apiFetch(`/api/skills/${slug}`)
    if (response.ok) {
      selectedSkill.value = (await response.json() as SkillDetail)
    }
  }
}

function toggleSkill(slug: string) {
  enabled.value = {
    ...enabled.value,
    [slug]: !enabled.value[slug],
  }
}

async function handleSave(data: { name: string, description: string, content: string }) {
  if (!selectedSkill.value) return
  
  saving.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/skills/${selectedSkill.value.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        content: data.content,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      error.value = errorText || 'Failed to save skill'
      return
    }

    // Update local skill data
    const skillIndex = skills.value.findIndex(s => s.slug === selectedSkill.value?.slug)
    if (skillIndex >= 0) {
      skills.value[skillIndex] = {
        ...skills.value[skillIndex],
        name: data.name,
        description: data.description,
      }
    }

    if (selectedSkill.value) {
      selectedSkill.value.name = data.name
      selectedSkill.value.description = data.description
      selectedSkill.value.content = data.content
    }

    editModalOpen.value = false
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!selectedSkill.value) return

  deleting.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/skills/${selectedSkill.value.slug}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorText = await response.text()
      error.value = errorText || 'Failed to delete skill'
      return
    }

    // Remove from list
    skills.value = skills.value.filter(s => s.slug !== selectedSkill.value?.slug)
    expandedSkillSlug.value = null
    selectedSkill.value = null
    deleteConfirmOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadSkills)
</script>

<template>
  <SettingsTabs active="skills">
    <div class="max-w-2xl space-y-6">
      <p class="text-xs text-muted-foreground">Enable or disable capabilities available to IO agents. Click to expand and edit skills.</p>
      
      <div v-if="error" class="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
        <button class="ml-2 text-destructive/50 hover:text-destructive" @click="error = ''">✕</button>
      </div>

      <div v-for="[category, entries] in groupedSkills" :key="category">
        <div class="mb-2 flex items-center gap-2">
          <div class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: categoryColors[category] ?? '#00d9ff' }" />
          <span class="font-mono text-[10px] font-semibold uppercase tracking-wider" :style="{ color: categoryColors[category] ?? '#00d9ff' }">{{ category }}</span>
          <div class="h-px flex-1 bg-border/40" />
          <span class="font-mono text-[10px] text-muted-foreground/40">{{ entries.filter((skill) => enabled[skill.slug]).length }}/{{ entries.length }}</span>
        </div>
        <div class="overflow-hidden rounded-lg border border-border">
          <div v-for="(skill, index) in entries" :key="skill.slug">
            <!-- Main row -->
            <div class="flex items-center gap-3 bg-card px-4 py-2.5 transition-colors hover:bg-card/80" :class="index > 0 ? 'border-t border-border/50' : ''">
              <code class="w-36 shrink-0 break-all font-mono text-xs text-foreground/80">{{ skill.name }}</code>
              <span class="flex-1 text-xs leading-relaxed text-muted-foreground">{{ skill.description }}</span>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  class="rounded border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:text-primary"
                  @click="expandSkill(skill.slug)"
                >
                  <AppIcon :name="expandedSkillSlug === skill.slug ? 'chevron-up' : 'chevron-down'" class="h-3 w-3" />
                </button>
                <span class="shrink-0 font-mono text-[9px] text-muted-foreground/30">built-in</span>
                <button type="button" class="relative h-4 w-8 shrink-0 rounded-full transition-colors" :class="enabled[skill.slug] ? 'bg-primary' : 'bg-white/10'" @click="toggleSkill(skill.slug)">
                  <span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform" :class="enabled[skill.slug] ? 'translate-x-4' : 'translate-x-0'" />
                </button>
              </div>
            </div>

            <!-- Expanded detail view -->
            <transition enter-active-class="duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
              <div v-if="expandedSkillSlug === skill.slug && selectedSkill" class="border-t border-border/50 bg-white/[0.03] px-4 py-3">
                <div class="mb-2 text-xs text-muted-foreground/60 font-mono uppercase tracking-wider">Content Preview</div>
                <div class="mb-3 max-h-40 overflow-y-auto rounded border border-border/50 bg-sidebar p-2 font-mono text-[11px] text-foreground/60 whitespace-pre-wrap break-words">{{ selectedSkill.content }}</div>
                <div class="flex gap-2 justify-end">
                  <button
                    class="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
                    @click="editModalOpen = true"
                  >
                    Edit
                  </button>
                  <button
                    class="rounded border border-destructive/40 px-3 py-1.5 font-mono text-xs text-destructive transition-colors hover:bg-destructive/10"
                    @click="deleteConfirmOpen = true"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </SettingsTabs>

  <!-- Modals -->
  <SkillEditModal
    :open="editModalOpen"
    :skill-name="selectedSkill?.name ?? ''"
    :skill-slug="selectedSkill?.slug ?? ''"
    :skill-description="selectedSkill?.description ?? ''"
    :skill-content="selectedSkill?.content ?? ''"
    @close="editModalOpen = false"
    @save="handleSave"
  />
  <SkillDeleteConfirmation
    :open="deleteConfirmOpen"
    :skill-name="selectedSkill?.name ?? ''"
    @close="deleteConfirmOpen = false"
    @confirm="handleDelete"
  />
</template>
