<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { contrastInk } from './scheme-viewer/color'
import { useSchemeStore } from '../stores/scheme'

export type PaletteRow = {
  symbol: string | null
  icon: string | null
  code: string
  color: string
  done: number
  total: number
}

defineProps<{
  rows: PaletteRow[]
}>()

const { t } = useI18n()
const schemeStore = useSchemeStore()
const { activeCode, activeCodeColor, hiddenCodes } = storeToRefs(schemeStore)
</script>

<template>
  <UiScrollY class="palette-table-wrap">
    <table class="palette-table">
      <thead>
        <tr>
          <th scope="col" class="palette-table__swatch">
            {{ t('palette.columns.symbol') }}
          </th>
          <th scope="col" class="palette-table__code">
            {{ t('palette.columns.code') }}
          </th>
          <th
            scope="col"
            class="palette-table__select"
            :title="t('palette.columns.active')"
          >
            {{ t('palette.columns.active') }}
          </th>
          <th
            scope="col"
            class="palette-table__hidden"
            :title="t('palette.columns.exclude')"
          >
            {{ t('palette.columns.exclude') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.code">
          <td class="palette-table__swatch">
            <div class="palette-swatch">
              <UiColorPicker
                variant="flat"
                :model-value="row.color"
                :title="row.color"
              />
              <span
                class="palette-swatch__mark"
                :style="{ color: contrastInk(row.color) }"
                aria-hidden="true"
              >
                <i v-if="row.icon" :class="row.icon" />
                <template v-else>{{ row.symbol ?? '' }}</template>
              </span>
            </div>
          </td>
          <td class="palette-table__code">{{ row.code }}</td>
          <td class="palette-table__select">
            <UiRadio
              :checked="activeCode === row.code"
              :color="activeCodeColor"
              :aria-label="t('palette.setActive', { code: row.code })"
              @click="schemeStore.toggleActiveCode(row.code)"
            />
          </td>
          <td class="palette-table__hidden">
            <UiCheckbox
              :model-value="hiddenCodes.has(row.code)"
              :aria-label="t('palette.excludeFromStats', { code: row.code })"
              @update:model-value="schemeStore.setCodeHidden(row.code, $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </UiScrollY>
</template>

<style scoped>
.palette-table-wrap {
  flex: 1 1 auto;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Скролл внутри радиуса — углы/рамка не подрезаются прямоугольником viewport */
.palette-table-wrap :deep(.scroll-y__viewport) {
  border-radius: inherit;
}

.palette-table {
  width: 100%;
  display: grid;
  /*
   * Символ / код — по контенту (код не жмём).
   * Активный / исключить — до max-content, при нехватке места сжимаются до контрола.
   */
  grid-template-columns:
    max-content
    minmax(max-content, 1fr)
    minmax(var(--space-5), max-content)
    minmax(var(--space-5), max-content);
  column-gap: var(--space-4);
  padding-inline: var(--space-4);
  font-size: var(--text-md);
}

.palette-table tbody {
  display: contents;
}

/* thead / tr — полноценные ряды (subgrid), чтобы красить фон и бордер на строку */
.palette-table thead,
.palette-table tbody tr {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
}

.palette-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  border-bottom: var(--border-width) solid var(--color-border);
}

.palette-table thead tr {
  display: contents;
}

.palette-table tbody tr:not(:last-child) {
  border-bottom: var(--border-width) solid var(--color-border);
}

.palette-table th,
.palette-table td {
  display: flex;
  align-items: center;
  padding: var(--space-3) 0;
  text-align: left;
}

.palette-table th {
  font-weight: var(--font-semibold);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.palette-table__code {
  white-space: nowrap;
}

.palette-table th.palette-table__swatch,
.palette-table td.palette-table__swatch,
.palette-table th.palette-table__select,
.palette-table td.palette-table__select,
.palette-table th.palette-table__hidden,
.palette-table td.palette-table__hidden {
  justify-content: center;
  text-align: center;
}

/* Иначе min-width:auto не даст колонкам ужаться ниже текста заголовка */
.palette-table th.palette-table__select,
.palette-table td.palette-table__select,
.palette-table th.palette-table__hidden,
.palette-table td.palette-table__hidden {
  min-width: 0;
}

.palette-table th.palette-table__select,
.palette-table th.palette-table__hidden {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.palette-swatch__mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 1;
  pointer-events: none;
}

.palette-swatch__mark :deep(i) {
  font-size: inherit;
}
</style>
