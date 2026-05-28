<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    ariaLabel: "Toggle",
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function toggle() {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-label="ariaLabel"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
    :class="modelValue ? 'bg-primary' : 'bg-muted'"
    @click="toggle"
  >
    <span
      class="pointer-events-none h-4 w-4 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-200"
      :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
