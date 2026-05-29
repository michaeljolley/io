<script setup lang="ts">
  defineProps<{
    size?: number;
  }>();
</script>

<template>
  <img src="/logo.svg" alt="IO" :width="size ?? 32" :height="size ?? 32" class="inline-block" />
</template>
