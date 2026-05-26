<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { apiFetch } from '@/lib/api'

interface Props {
  open: boolean
  skillName: string
  skillSlug: string
  skillDescription: string
  skillContent: string
}

interface Emits {
  (event: 'close'): void
  (event: 'save', data: { name: string, description: string, content: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const editName = ref('')
const editDescription = ref('')
const editContent = ref('')
const loading = ref(false)
const error = ref('')

async function save() {
  if (!editName.value.trim()) {
    error.value = 'Skill name cannot be empty'
    return
  }

  if (!editDescription.value.trim()) {
    error.value = 'Description cannot be empty'
    return
  }

  loading.value = true
  error.value = ''

  try {
    emit('save', {
      name: editName.value,
      description: editDescription.value,
      content: editContent.value,
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  editName.value = props.skillName
  editDescription.value = props.skillDescription
  editContent.value = props.skillContent
})
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" @click="emit('close')" />
    </transition>

    <transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div v-if="open" class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-6 max-h-[90vh]">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Edit Skill</h3>
          <button class="text-muted-foreground/40 transition-colors hover:text-foreground" @click="emit('close')">
            <AppIcon name="x" class="h-5 w-5" />
          </button>
        </div>

        <div v-if="error" class="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <!-- Skill name -->
        <div class="mb-4">
          <label class="block font-mono text-xs uppercase tracking-wider text-muted-foreground/60">Skill Name</label>
          <input
            v-model="editName"
            type="text"
            class="mt-1 w-full rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground font-mono"
            placeholder="e.g., grep"
          />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="block font-mono text-xs uppercase tracking-wider text-muted-foreground/60">Description</label>
          <input
            v-model="editDescription"
            type="text"
            class="mt-1 w-full rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground"
            placeholder="Brief description of the skill"
          />
        </div>

        <!-- Content -->
        <div class="mb-4">
          <label class="block font-mono text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">Content</label>
          <textarea
            v-model="editContent"
            class="w-full h-40 rounded border border-border bg-sidebar px-3 py-2 text-sm text-foreground font-mono"
            placeholder="Skill implementation content"
          />
        </div>

        <!-- Buttons -->
        <div class="flex gap-2 justify-end">
          <button
            class="rounded border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            @click="emit('close')"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            class="rounded bg-primary/15 px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
            @click="save"
            :disabled="loading"
          >
            <span v-if="loading">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </transition>
  </teleport>
</template>
