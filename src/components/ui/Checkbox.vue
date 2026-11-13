<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    /** Цвет рамки и галочки в выбранном состоянии. */
    color?: string
  }>(),
  {
    color: undefined,
  },
)

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <div class="checkbox-wrap">
    <button
      type="button"
      class="checkbox"
      role="checkbox"
      v-bind="$attrs"
      :aria-checked="model"
      :style="
        color
          ? { '--checkbox-active-color': color }
          : undefined
      "
      @click="model = !model"
    >
      <IconsCheck
        v-if="model"
        class="checkbox__mark"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.checkbox-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height);
}

.checkbox {
  position: relative;
  display: inline-block;
  width: var(--space-5);
  height: var(--space-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-surface);
  overflow: hidden;
}

.checkbox:hover {
  border-color: var(--color-text-muted);
}

.checkbox:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.checkbox[aria-checked='true'] {
  border-color: var(--checkbox-active-color, var(--color-text));
  background: var(--checkbox-active-color, var(--color-text));
}

.checkbox__mark {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: var(--space-5);
  height: var(--space-5);
  /* иначе reset `svg { max-width: 100% }` жмёт до content-box внутри бордера */
  max-width: none;
  /* не grid safe-center: иначе oversized svg уезжает вправо/вниз */
  transform: translate(-50%, -50%);
}
</style>
