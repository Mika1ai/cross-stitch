<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    checked?: boolean
    /** Цвет обводки и точки в выбранном состоянии. */
    color?: string
  }>(),
  {
    checked: false,
    color: undefined,
  },
)
</script>

<template>
  <div class="radio-wrap">
    <button
      type="button"
      class="radio"
      role="radio"
      v-bind="$attrs"
      :aria-checked="checked"
      :style="
        color
          ? { '--radio-active-color': color }
          : undefined
      "
    >
      <span class="radio__dot" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.radio-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height);
}

.radio {
  position: relative;
  display: block;
  width: var(--space-5);
  height: var(--space-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
}

.radio:hover {
  border-color: var(--color-text-muted);
}

.radio:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.radio[aria-checked='true'] {
  border-color: var(--radio-active-color, var(--color-text));
}

.radio__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: transparent;
  transform: translate(-50%, -50%);
}

.radio[aria-checked='true'] .radio__dot {
  background: var(--radio-active-color, var(--color-text));
}
</style>
