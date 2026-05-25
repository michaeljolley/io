<template>
  <div class="group flex items-start gap-3 bg-bg-card border border-border rounded-lg px-3.5 py-2.5 hover:border-border-bright transition-colors">
    <input v-if="selectMode" type="checkbox" :checked="selected" @change="$emit('select')" class="mt-0.5 shrink-0 w-3.5 h-3.5 accent-accent-cyan rounded" />
    <span v-else class="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" :class="unread ? (entry.type === 'inbox' ? 'bg-accent-cyan' : 'bg-accent-purple') : 'bg-text-muted/40'"></span>
    <div class="flex-1 min-w-0">
      <button @click="$emit('expand')" class="w-full text-left">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-text truncate font-medium">{{ entry.title }}</span>
          <span class="text-[11px] text-text-muted shrink-0 font-mono">{{ formatDate(entry.created_at) }}</span>
        </div>
        <p v-if="!expanded && entry.body" class="text-xs text-text-muted mt-0.5 truncate">{{ entry.body }}</p>
      </button>
      <div v-if="expanded" class="mt-2 pt-2 border-t border-border text-sm text-text-secondary whitespace-pre-wrap">{{ entry.body }}</div>
    </div>
    <div class="shrink-0 flex items-center gap-2 mt-0.5">
      <button v-if="unread" @click="$emit('read')" class="opacity-0 group-hover:opacity-100 text-[10px] text-text-muted hover:text-accent-cyan transition-all">Read</button>
      <button @click="$emit('delete')" :disabled="deleting" class="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red disabled:opacity-30 transition-all"><svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/></svg></button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  entry: { id: number; type: string; title: string; body: string; created_at: string }
  selectMode: boolean
  selected: boolean
  expanded: boolean
  unread: boolean
  deleting?: boolean
}>()
defineEmits<{ select: []; expand: []; delete: []; read: [] }>()

function formatDate(val: string) {
  if (!val) return ''
  const iso = val.includes('T') ? val : val.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return val
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>
