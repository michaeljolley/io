<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";

const props = defineProps<{ content: string }>();

const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  const safeHref = href ?? "";
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

const rendered = computed(() => {
  if (!props.content) return "";
  return marked.parse(props.content, { async: false, renderer }) as string;
});
</script>

<template>
  <div class="prose prose-sm dark:prose-invert max-w-none" v-html="rendered"></div>
</template>
