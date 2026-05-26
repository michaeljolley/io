<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'grid'">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M5 5.5a2.5 2.5 0 0 1 2.5-2.5H20v17H7.5A2.5 2.5 0 0 0 5 22Z" />
      <path d="M5 5.5V22" />
      <path d="M9 7h7" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1 0 2.7 1.9 1.9 0 0 1-2.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.9 1.9 0 0 1-2.7 0 1.9 1.9 0 0 1 0-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.9 1.9 0 0 1 0-2.7 1.9 1.9 0 0 1 2.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.9 1.9 0 0 1 2.7 0 1.9 1.9 0 0 1 0 2.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </template>
    <template v-else-if="name === 'terminal'">
      <path d="M4 6h16v12H4z" rx="2" />
      <path d="m8 10 2 2-2 2" />
      <path d="M12.5 16H16" />
    </template>
    <template v-else-if="name === 'message'">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5Z" />
    </template>
    <template v-else-if="name === 'activity'">
      <path d="M4 12h4l2.2-5 3.6 10 2.2-5H20" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
      <path d="m19 14 .7 2.1L22 16.8l-2.3.7L19 20l-.7-2.5-2.3-.7 2.3-.7Z" />
      <path d="m5 15 .8 2.3L8 18l-2.2.7L5 21l-.8-2.3L2 18l2.2-.7Z" />
    </template>
    <template v-else-if="name === 'git-branch'">
      <path d="M6 4v9a3 3 0 1 0 2 2.8V8h8" />
      <path d="M16 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M8 16a3 3 0 1 0-4 2.8" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'chevron-up'">
      <path d="m6 15 6-6 6 6" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 7V4h6v3" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </template>
    <template v-else-if="name === 'zap'">
      <path d="M13 2 5 13h5l-1 9 8-11h-5Z" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M3.5 9.5h17" />
    </template>
    <template v-else-if="name === 'inbox'">
      <path d="M4 6h16l-2 10H6Z" />
      <path d="M8 12h8" />
      <path d="M7 16h10" />
    </template>
    <template v-else-if="name === 'server'">
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01" />
      <path d="M8 17h.01" />
    </template>
    <template v-else-if="name === 'circle'">
      <circle cx="12" cy="12" r="4.25" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>
