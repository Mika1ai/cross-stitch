<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Цвет трека во включённом состоянии. */
    color?: string
  }>(),
  {
    color: undefined,
  },
)

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <div class="toggle-wrap">
    <button
      type="button"
      class="toggle"
      role="switch"
      :aria-checked="model"
      :style="
        color
          ? { '--toggle-active-color': color }
          : undefined
      "
      @click="model = !model"
    >
      <span class="toggle__thumb" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.toggle-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height);
}

.toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  /* thumb --space-4 + padding; ширина ≈ два положения thumb */
  width: calc(2 * var(--space-4) + 2 * var(--space-1) + 2 * var(--border-width));
  height: calc(var(--space-4) + 2 * var(--space-1) + 2 * var(--border-width));
  padding: var(--space-1);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  vertical-align: middle;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.toggle:hover {
  border-color: var(--color-text-muted);
}

.toggle:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.toggle[aria-checked='true'] {
  border-color: var(--toggle-active-color, var(--color-text));
  background: var(--toggle-active-color, var(--color-text));
}

.toggle__thumb {
  display: block;
  width: var(--space-4);
  height: var(--space-4);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-thumb);
  transition: transform var(--duration-fast) var(--ease-out);
}

.toggle[aria-checked='true'] .toggle__thumb {
  transform: translateX(var(--space-4));
}
</style>
