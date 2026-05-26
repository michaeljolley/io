<script setup lang="ts">
interface Props {
  open: boolean
  skillName: string
}

interface Emits {
  (event: 'close'): void
  (event: 'confirm'): void
}

defineProps<Props>()
defineEmits<Emits>()
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
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" @click="$emit('close')" />
    </transition>

    <transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div v-if="open" class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6">
        <h3 class="mb-2 text-lg font-semibold">Delete Skill?</h3>
        <p class="mb-4 text-sm text-muted-foreground">
          Are you sure you want to delete <code class="text-foreground/80 font-mono">{{ skillName }}</code>?
          This action cannot be undone.
        </p>

        <div class="flex gap-2 justify-end">
          <button
            class="rounded border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            class="rounded bg-destructive/15 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/25"
            @click="$emit('confirm')"
          >
            Delete
          </button>
        </div>
      </div>
    </transition>
  </teleport>
</template>
