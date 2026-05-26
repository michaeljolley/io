<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { renderMarkdown } from '@/lib/markdown'

type SkillSummary = {
  name: string
  slug: string
  description: string
  path: string
}

type SkillDetail = {
  slug: string
  content: string
}

const skills = ref<SkillSummary[]>([])
const selectedSlug = ref('')
const detail = ref<SkillDetail | null>(null)
const query = ref('')
const url = ref('')
const pasteName = ref('skill.md')
const pasteContent = ref('')
const busy = ref(false)

const filteredSkills = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return skills.value
  return skills.value.filter((skill) => `${skill.name} ${skill.slug} ${skill.description}`.toLowerCase().includes(needle))
})

async function loadSkills() {
  const response = await apiFetch('/api/skills')
  if (response.ok) {
    skills.value = (await response.json() as { skills: SkillSummary[] }).skills
    if (!selectedSlug.value && skills.value[0]) {
      selectedSlug.value = skills.value[0].slug
    }
  }
}

async function loadDetail(slug: string) {
  if (!slug) return
  const response = await apiFetch(`/api/skills/${encodeURIComponent(slug)}`)
  if (response.ok) {
    detail.value = await response.json() as SkillDetail
  }
}

async function installFromUrl() {
  if (!url.value.trim()) return
  busy.value = true
  await apiFetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.value.trim() }),
  })
  url.value = ''
  await loadSkills()
  busy.value = false
}

async function pasteSkill() {
  if (!pasteContent.value.trim()) return
  busy.value = true
  await apiFetch('/api/skills/paste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: pasteContent.value, filename: pasteName.value }),
  })
  pasteContent.value = ''
  await loadSkills()
  busy.value = false
}

async function removeSkill() {
  if (!selectedSlug.value) return
  busy.value = true
  await apiFetch(`/api/skills/${encodeURIComponent(selectedSlug.value)}`, { method: 'DELETE' })
  selectedSlug.value = ''
  detail.value = null
  await loadSkills()
  busy.value = false
}

watch(selectedSlug, (slug) => {
  loadDetail(slug)
})

onMounted(loadSkills)
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
      <div class="border-b border-line px-5 py-4">
        <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">skill registry</div>
        <input v-model="query" class="focus-ring mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white placeholder:text-slate-500" placeholder="filter skills" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          v-for="skill in filteredSkills"
          :key="skill.slug"
          class="mb-2 w-full rounded-[22px] border px-4 py-4 text-left transition"
          :class="selectedSlug === skill.slug ? 'border-cyan bg-cyan/10' : 'border-line bg-panel hover:border-bright hover:bg-elevated'"
          @click="selectedSlug = skill.slug"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-white">{{ skill.name }}</div>
              <div class="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">{{ skill.slug }}</div>
            </div>
            <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">{{ skill.path }}</div>
          </div>
          <div class="mt-2 text-sm leading-6 text-slate-300">{{ skill.description }}</div>
        </button>
      </div>
    </section>

    <section class="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-[28px] border border-violet/35 bg-surface/95 p-5 shadow-violet">
          <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-violet">install from url</div>
          <input v-model="url" class="focus-ring mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="https://…/SKILL.md" @keydown.enter.prevent="installFromUrl" />
          <button class="mt-3 rounded-2xl border border-violet/40 bg-violet/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-violet" :disabled="busy" @click="installFromUrl">install</button>
        </div>
        <div class="rounded-[28px] border border-line bg-surface/95 p-5">
          <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">paste skill</div>
          <input v-model="pasteName" class="focus-ring mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-white" placeholder="filename.md" />
          <textarea v-model="pasteContent" rows="5" class="focus-ring mt-3 w-full rounded-2xl border border-line bg-panel px-4 py-3 font-mono text-sm text-white" placeholder="markdown content" />
          <div class="mt-3 flex justify-between gap-3">
            <button class="rounded-2xl border border-cyan/40 bg-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan" :disabled="busy" @click="pasteSkill">save skill</button>
            <button class="rounded-2xl border border-danger/40 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-danger" :disabled="busy || !selectedSlug" @click="removeSkill">delete selected</button>
          </div>
        </div>
      </div>

      <div class="min-h-0 overflow-hidden rounded-[28px] border border-line bg-[#09090d]/96">
        <div class="border-b border-line px-5 py-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan">{{ detail?.slug ?? 'select a skill' }}</div>
        </div>
        <div class="wiki-content min-h-0 h-full overflow-y-auto px-6 py-6" v-html="renderMarkdown(detail?.content ?? 'Select a skill from the registry to inspect its markdown.')" />
      </div>
    </section>
  </div>
</template>
