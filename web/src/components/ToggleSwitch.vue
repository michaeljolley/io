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
    class="inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border p-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
    :class="modelValue ? 'bg-gradient-brand shadow-[0_0_0_1px_rgba(228,58,156,0.35)]' : 'bg-muted'"
    @click="toggle"
  >
    <span
      class="pointer-events-none h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200"
      :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
