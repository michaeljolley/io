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
  <div class="prose prose-sm dark:prose-invert max-w-none markdown-content" v-html="rendered"></div>
</template>

<style>
  .markdown-content :deep(h1),
  .markdown-content :deep(h2),
  .markdown-content :deep(h3),
  .markdown-content :deep(h4),
  .markdown-content :deep(h5),
  .markdown-content :deep(h6) {
    background: linear-gradient(135deg, #d83333 0%, #c0285e 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
</style>
