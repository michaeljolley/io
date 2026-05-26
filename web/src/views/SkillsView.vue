<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SettingsTabs from '@/components/SettingsTabs.vue'
import { apiFetch } from '@/lib/api'
import { categorizeSkill } from '@/lib/mission-control'

type SkillSummary = {
  name: string
  slug: string
  description: string
  path: string
}

const categoryColors: Record<string, string> = {
  'File System': '#00d9ff',
  'Code Intelligence': '#5fff87',
  'Git & CI': '#c4a7ff',
  Communication: '#ffd000',
}

const skills = ref<SkillSummary[]>([])
const enabled = ref<Record<string, boolean>>({})

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

function toggleSkill(slug: string) {
  enabled.value = {
    ...enabled.value,
    [slug]: !enabled.value[slug],
  }
}

onMounted(loadSkills)
</script>

<template>
  <SettingsTabs active="skills">
    <div class="max-w-2xl space-y-6">
      <p class="text-xs text-muted-foreground">Enable or disable capabilities available to IO agents. Built-in skills cannot be removed here; the toggles model the operator deck from the reference design.</p>
      <div v-for="[category, entries] in groupedSkills" :key="category">
        <div class="mb-2 flex items-center gap-2">
          <div class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: categoryColors[category] ?? '#00d9ff' }" />
          <span class="font-mono text-[10px] font-semibold uppercase tracking-wider" :style="{ color: categoryColors[category] ?? '#00d9ff' }">{{ category }}</span>
          <div class="h-px flex-1 bg-border/40" />
          <span class="font-mono text-[10px] text-muted-foreground/40">{{ entries.filter((skill) => enabled[skill.slug]).length }}/{{ entries.length }}</span>
        </div>
        <div class="overflow-hidden rounded-lg border border-border">
          <div v-for="(skill, index) in entries" :key="skill.slug" class="flex items-center gap-3 bg-card px-4 py-2.5 transition-colors hover:bg-card/80" :class="index > 0 ? 'border-t border-border/50' : ''">
            <code class="w-40 shrink-0 font-mono text-xs text-foreground/80">{{ skill.name }}</code>
            <span class="flex-1 text-xs leading-relaxed text-muted-foreground">{{ skill.description }}</span>
            <span class="shrink-0 font-mono text-[9px] text-muted-foreground/30">built-in</span>
            <button type="button" class="relative h-4 w-8 shrink-0 rounded-full transition-colors" :class="enabled[skill.slug] ? 'bg-primary' : 'bg-white/10'" @click="toggleSkill(skill.slug)">
              <span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform" :class="enabled[skill.slug] ? 'translate-x-4' : 'translate-x-0'" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </SettingsTabs>
</template>
