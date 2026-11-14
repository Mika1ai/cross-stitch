<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChromePicker } from 'vue-color'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** Разрешить выбор прозрачности (alpha). */
    alpha?: boolean
    /**
     * `flat` — только триггер/swatch, панель пикера не рендерится и не открывается.
     */
    variant?: 'default' | 'flat'
  }>(),
  {
    disabled: false,
    alpha: false,
    variant: 'default',
  },
)

const model = defineModel<string>({ default: '#000000' })

const isFlat = computed(() => props.variant === 'flat')

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function placePanel() {
  if (isFlat.value) return
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const gap = 8
  const estimatedHeight = props.alpha ? 320 : 280
  const spaceBelow = window.innerHeight - rect.bottom
  const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow

  panelStyle.value = {
    position: 'fixed',
    left: `${Math.max(8, rect.right - 230)}px`,
    top: openUp
      ? `${Math.max(8, rect.top - estimatedHeight - gap)}px`
      : `${rect.bottom + gap}px`,
    zIndex: '60',
  }
}

async function toggle() {
  if (isFlat.value || props.disabled) return
  open.value = !open.value
  if (open.value) {
    await nextTick()
    placePanel()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (isFlat.value || !open.value) return
  const target = event.target as Node
  if (rootRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  open.value = false
}

function onWindowChange() {
  if (isFlat.value || !open.value) return
  placePanel()
}

watch(open, (isOpen) => {
  if (isOpen) placePanel()
})

onMounted(() => {
  if (isFlat.value) return
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('scroll', onWindowChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})
</script>

<template>
  <div
    ref="rootRef"
    class="color-picker"
    :class="{
      'color-picker--disabled': props.disabled,
      'color-picker--flat': isFlat,
    }"
  >
    <!-- flat: не button — только превью цвета -->
    <div
      v-if="isFlat"
      class="color-picker__trigger color-picker__trigger--flat"
    >
      <span class="color-picker__swatch" aria-hidden="true">
        <span
          class="color-picker__swatch-fill"
          :style="{ backgroundColor: model }"
        />
      </span>
    </div>

    <button
      v-else
      ref="triggerRef"
      type="button"
      class="color-picker__trigger"
      :disabled="props.disabled"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span class="color-picker__swatch" aria-hidden="true">
        <span
          class="color-picker__swatch-fill"
          :style="{ backgroundColor: model }"
        />
      </span>
    </button>

    <Teleport v-if="!isFlat" to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="color-picker__panel"
        role="dialog"
        :style="panelStyle"
      >
        <ChromePicker
          v-model="model"
          :disable-alpha="!props.alpha"
          :formats="['hex']"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.color-picker {
  display: inline-flex;
}

.color-picker__trigger {
  display: inline-flex;
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

@media (hover: hover) and (pointer: fine) {
  .color-picker__trigger:hover:not(:disabled):not(.color-picker__trigger--flat) {
    background: var(--color-surface-hover);
    border-color: var(--color-border);
    color: var(--color-text);
  }
}

.color-picker__trigger:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.color-picker__trigger--flat {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  pointer-events: none;
  cursor: default;
}

.color-picker--flat .color-picker__swatch {
  width: var(--space-6);
  height: var(--space-6);
}

.color-picker--disabled {
  opacity: 0.5;
}

.color-picker__swatch {
  display: block;
  width: var(--space-5);
  height: var(--space-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: var(--color-checker-light);
  background-image:
    linear-gradient(45deg, var(--color-checker-dark) 25%, transparent 25%),
    linear-gradient(-45deg, var(--color-checker-dark) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--color-checker-dark) 75%),
    linear-gradient(-45deg, transparent 75%, var(--color-checker-dark) 75%);
  background-size: var(--space-2) var(--space-2);
  background-position:
    0 0,
    0 var(--space-1),
    var(--space-1) calc(-1 * var(--space-1)),
    calc(-1 * var(--space-1)) 0;
}

.color-picker__swatch-fill {
  display: block;
  width: 100%;
  height: 100%;
}

/* Панель пикера: токены vue-color → наши CSS-переменные (светлая/тёмная тема подхватывается сама) */
.color-picker__panel {
  --vc-body-bg: var(--color-surface);
  --vc-picker-bg: var(--color-surface);
  --vc-input-bg: var(--color-bg);
  --vc-input-text: var(--color-text);
  --vc-input-label: var(--color-text-muted);
  --vc-input-border: var(--color-border);
  --vc-chrome-toggle-btn-highlighted: var(--color-surface-hover);
  --vc-ps-bg: var(--color-surface);
  --vc-ps-title-bg-gradient-start: var(--color-surface-hover);
  --vc-ps-title-bg-gradient-end: var(--color-bg);
  --vc-ps-title-border: var(--color-border);
  --vc-ps-title-color: var(--color-text);
  --vc-ps-slider-border: var(--color-border);
  --vc-ps-slider-border-bottom: var(--color-surface-hover);
  --vs-ps-picker-border-dark: var(--color-text);
  --vs-ps-picker-border-white: var(--color-surface);
  --vc-ps-btn-gradient-start: var(--color-surface);
  --vc-ps-btn-gradient-end: var(--color-surface-hover);
  --vc-ps-btn-border: var(--color-border);
  --vc-ps-btn-shadow: var(--color-bg);
  --vc-ps-btn-color: var(--color-text);
  --vc-ps-preview-border: var(--color-border);
  --vc-ps-label: var(--color-text);
  --vc-ps-input-border: var(--color-border);
  --vc-ps-input-shadow-dark: transparent;
  --vc-ps-input-shadow-light: transparent;
  --vc-sketch-input-label: var(--color-text-muted);
  --vc-sketch-presets-border: var(--color-border);
}

.color-picker__panel :deep(.vc-chrome-picker) {
  width: 14rem;
  font-family: var(--font-sans);
  border-radius: var(--radius-md);
  border: var(--border-width) solid var(--color-border);
  box-shadow: none;
  overflow: hidden;
  background: var(--color-surface);
  color: var(--color-text);
}

.color-picker__panel :deep(.vc-chrome-picker .body) {
  padding: var(--space-3);
  background-color: var(--color-surface);
}

.color-picker__panel :deep(.vc-chrome-picker .saturation) {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.color-picker__panel :deep(.vc-chrome-picker .hue-wrap .container),
.color-picker__panel :deep(.vc-chrome-picker .alpha-wrap .gradient) {
  border-radius: var(--radius-sm);
}

.color-picker__panel :deep(.vc-chrome-picker .fields) {
  margin-left: calc(-1 * var(--space-2));
}

.color-picker__panel :deep(.vc-chrome-picker .field) {
  padding-left: var(--space-2);
}

.color-picker__panel :deep(.vc-chrome-picker .fields .vc-input-input) {
  height: auto;
  min-height: 1.75rem;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-inset-border);
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
}

.color-picker__panel :deep(.vc-chrome-picker .fields .vc-input-label) {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: var(--leading-tight);
}

.color-picker__panel :deep(.vc-chrome-picker .toggle-icon) {
  color: var(--color-text);
}

.color-picker__panel :deep(.vc-chrome-picker .toggle-icon_highlighted) {
  background: var(--color-surface-hover);
  border-radius: var(--radius-sm);
}

.color-picker__panel :deep(.vc-chrome-picker .active-color) {
  box-shadow: var(--shadow-inset-border);
}
</style>
