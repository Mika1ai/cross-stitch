<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useAttrs,
  useTemplateRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ inheritAttrs: false })

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    autocomplete?: string
    inputmode?:
      | 'none'
      | 'text'
      | 'decimal'
      | 'numeric'
      | 'tel'
      | 'search'
      | 'email'
      | 'url'
    /** Выравнивание текста. */
    align?: 'left' | 'center' | 'right'
    /**
     * Search-режим: type=text + кастомная кнопка очистки (IconsClose).
     */
    search?: boolean
    /**
     * Ширина по содержимому (растёт с текстом).
     * Границы — через minWidth / maxWidth.
     */
    autoGrow?: boolean
    /**
     * Мин. ширина (CSS), без бордеров; к итоговой border-box бордеры добавляются.
     * По умолчанию при autoGrow: var(--control-height).
     */
    minWidth?: string
    /**
     * Макс. ширина (CSS), без бордеров; к итоговой border-box бордеры добавляются.
     */
    maxWidth?: string
    /**
     * Минимальное числовое значение. На blur: пусто / нечисло / ниже min → подставить min.
     */
    min?: number
    /**
     * Разрешённое значение (RegExp или строка → RegExp).
     * Символы, после которых value не матчится, отбрасываются по мере ввода/вставки.
     */
    pattern?: RegExp | string
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    autocomplete: undefined,
    inputmode: undefined,
    align: undefined,
    search: false,
    autoGrow: false,
    minWidth: undefined,
    maxWidth: undefined,
    min: undefined,
    pattern: undefined,
  },
)

const attrs = useAttrs()
const model = defineModel<string>({ default: '' })
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')
/** Заданная JS-ширина (border-box), только для autoGrow. */
const autoGrowPx = ref<number | null>(null)

const nativeType = computed(() => (props.search ? 'text' : props.type))
const showClear = computed(() => props.search && model.value.length > 0)

const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs as Record<
    string,
    unknown
  >
  return rest
})

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx() {
  if (measureCtx) return measureCtx
  const canvas = document.createElement('canvas')
  measureCtx = canvas.getContext('2d')
  return measureCtx
}

function measureValueWidth(el: HTMLInputElement, text: string) {
  const ctx = getMeasureCtx()
  if (!ctx) return 0
  const styles = getComputedStyle(el)
  ctx.font = [
    styles.fontStyle,
    styles.fontVariant,
    styles.fontWeight,
    styles.fontSize,
    styles.fontFamily,
  ].join(' ')
  // пустое — хотя бы ширина «0», чтобы не схлопывалось
  return ctx.measureText(text.length > 0 ? text : '0').width
}

/** CSS-длина → px (`rem` / `px` / `var(--token)`). */
function resolveLengthToPx(value: string): number | null {
  const raw = value.trim()
  if (!raw) return null

  const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw)
  if (varMatch) {
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue(varMatch[1]!)
      .trim()
    return token ? resolveLengthToPx(token) : null
  }

  const rootFontPx =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  if (raw.endsWith('rem')) {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n * rootFontPx : null
  }
  if (raw.endsWith('px') || /^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function syncAutoGrow(textOverride?: string) {
  const el = inputRef.value
  if (!props.autoGrow || !el) {
    autoGrowPx.value = null
    return
  }

  const styles = getComputedStyle(el)
  const borderX =
    (Number.parseFloat(styles.borderLeftWidth) || 0) +
    (Number.parseFloat(styles.borderRightWidth) || 0)
  const paddingX =
    (Number.parseFloat(styles.paddingLeft) || 0) +
    (Number.parseFloat(styles.paddingRight) || 0)

  const text = textOverride ?? model.value
  const textW = measureValueWidth(el, text)
  // +1px запас против скругления/субпикселей (border-box)
  const need = textW + paddingX + borderX + 1

  // minWidth — без бордеров; к border-box добавляем borderX
  const minInner = resolveLengthToPx(
    props.minWidth ?? 'var(--control-height)',
  )
  const minBorderBox = (minInner ?? 0) + borderX

  let next = Math.max(minBorderBox, need)

  // maxWidth — тоже без бордеров (симметрично min)
  if (props.maxWidth) {
    const maxInner = resolveLengthToPx(props.maxWidth)
    if (maxInner != null) next = Math.min(next, maxInner + borderX)
  }

  autoGrowPx.value = next
}

function resolvePattern(): RegExp | null {
  const raw = props.pattern
  if (raw == null || raw === '') return null
  return typeof raw === 'string' ? new RegExp(raw) : raw
}

/** Оставляет наибольший префикс, который целиком проходит pattern (посимвольно). */
function applyPattern(value: string): string {
  const re = resolvePattern()
  if (!re) return value
  if (re.test(value)) return value
  let result = ''
  for (const ch of value) {
    const next = result + ch
    if (re.test(next)) result = next
  }
  return result
}

function syncFromNative(el: HTMLInputElement) {
  const next = applyPattern(el.value)
  if (next !== el.value) el.value = next
  model.value = next
  syncAutoGrow(next)
}

function onNativeInput(event: Event) {
  syncFromNative(event.target as HTMLInputElement)
}

/** Autofill часто шлёт change без input — подхватываем в v-model. */
function onNativeChange(event: Event) {
  syncFromNative(event.target as HTMLInputElement)
}

function onBlur() {
  if (props.min == null) return
  const raw = model.value.trim()
  const parsed = Number.parseFloat(raw)
  if (raw === '' || !Number.isFinite(parsed) || parsed < props.min) {
    model.value = String(props.min)
    syncAutoGrow(model.value)
  }
}

async function clear() {
  model.value = ''
  syncAutoGrow('')
  await nextTick()
  inputRef.value?.focus()
}

const wrapStyle = computed(() => {
  if (!props.autoGrow || autoGrowPx.value == null) return undefined
  return { width: `${autoGrowPx.value}px` }
})

watch(
  [
    model,
    () => props.autoGrow,
    () => props.align,
    () => props.minWidth,
    () => props.maxWidth,
  ],
  async () => {
    await nextTick()
    syncAutoGrow()
  },
  { flush: 'post' },
)

onMounted(() => {
  syncAutoGrow()
})
</script>

<template>
  <div
    class="input-wrap"
    :class="[
      {
        'input-wrap--search': search,
        'input-wrap--auto-grow': autoGrow,
      },
      attrs.class,
    ]"
    :style="[wrapStyle, attrs.style as string | Record<string, string> | undefined]"
  >
    <input
      ref="inputRef"
      v-bind="inputAttrs"
      class="input"
      :class="{
        'input--search': search,
        [`input--align-${align}`]: align,
      }"
      :type="nativeType"
      :value="model"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      @input="onNativeInput"
      @change="onNativeChange"
      @blur="onBlur"
    />
    <button
      v-if="showClear"
      type="button"
      class="input__clear"
      :aria-label="t('common.clear')"
      @click="clear"
    >
      <IconsClose class="input__clear-icon" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.input-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.input-wrap--auto-grow {
  width: auto;
  flex: 0 0 auto;
}

.input {
  display: block;
  width: 100%;
  min-height: var(--control-height);
  padding: var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.input--search {
  /* справа: отступ + иконка + зазор до текста (как left padding) */
  padding-right: calc(var(--space-2) + var(--space-5) + var(--space-2));
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.input--align-left {
  text-align: left;
}

.input--align-center {
  text-align: center;
}

.input--align-right {
  text-align: right;
}

.input__clear {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  display: inline-grid;
  place-items: center;
  width: var(--space-5);
  height: var(--space-5);
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  transform: translateY(-50%);
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .input__clear:hover {
    color: var(--color-text);
  }
}

.input__clear:focus-visible {
  outline: var(--border-width) solid var(--color-focus);
  outline-offset: var(--border-width);
}

.input__clear-icon {
  display: block;
  width: var(--space-5);
  height: var(--space-5);
}
</style>
