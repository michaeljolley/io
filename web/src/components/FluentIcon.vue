<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    :viewBox="`0 0 ${viewBox} ${viewBox}`"
    fill="currentColor"
    aria-hidden="true"
    v-html="paths"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  paths: string
  size?: number | string
  viewBox?: number
}>(), {
  size: 20,
  viewBox: 20,
})
</script>
