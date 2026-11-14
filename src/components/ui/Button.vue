<script setup lang="ts">
withDefaults(
  defineProps<{
    iconSize?: string
    type?: 'button' | 'submit' | 'reset'
    /**
     * Акцент иконки/бордера: виден при hover и aria-pressed="true".
     * Без prop — обычные токены.
     */
    color?: string
  }>(),
  {
    iconSize: 'var(--space-5)',
    type: 'button',
    color: undefined,
  },
)
</script>

<template>
  <button
    :type="type"
    class="button"
    :style="{
      '--button-icon-size': iconSize,
      ...(color
        ? {
            '--button-accent-color': color,
            /* С акцентом hover только красит иконку/бордер, фон не трогаем */
            '--button-hover-bg': 'var(--color-surface)',
          }
        : {}),
    }"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  transition:
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}

.button:hover {
  background: var(--button-hover-bg, var(--color-surface-hover));
  border-color: var(--button-accent-color, var(--color-border));
  color: var(--button-accent-color, var(--color-text));
}

.button:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.button:disabled {
  opacity: var(--opacity-disabled);
  cursor: wait;
}

.button[aria-pressed='true'] {
  border-color: var(--button-accent-color, var(--color-text));
  background: var(--color-surface-hover);
  color: var(--button-accent-color, var(--color-text));
}

.button :deep(svg) {
  width: var(--button-icon-size);
  height: var(--button-icon-size);
  flex-shrink: 0;
}
</style>
