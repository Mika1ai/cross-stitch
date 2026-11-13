<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
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
          <th scope="col" class="palette-table__symbol">
            {{ t('palette.columns.symbol') }}
          </th>
          <th scope="col" class="palette-table__code">
            {{ t('palette.columns.code') }}
          </th>
          <th scope="col" class="palette-table__color">
            {{ t('palette.columns.color') }}
          </th>
          <th scope="col" class="palette-table__select">
            {{ t('palette.columns.active') }}
          </th>
          <th scope="col" class="palette-table__hidden">
            {{ t('palette.columns.exclude') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.code">
          <td class="palette-table__symbol">
            <i v-if="row.icon" :class="row.icon" aria-hidden="true" />
            <span v-else>{{ row.symbol }}</span>
          </td>
          <td class="palette-table__code">{{ row.code }}</td>
          <td class="palette-table__color">
            <UiColorPicker
              variant="flat"
              :model-value="row.color"
              :title="row.color"
            />
          </td>
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
  grid-template-columns: max-content max-content 1fr auto auto;
  font-size: var(--text-md);
}

/* Ячейки — прямые дети grid (для 1fr / max-content) */
.palette-table thead,
.palette-table tbody,
.palette-table tr {
  display: contents;
}

.palette-table th,
.palette-table td {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: none;
}

/* Разделители с боковым inset (--space-4), как блоки в настройках */
.palette-table thead th::after,
.palette-table tbody tr:not(:last-child) td::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--border-width);
  background: var(--color-border);
  pointer-events: none;
}

.palette-table thead th.palette-table__symbol::after,
.palette-table tbody tr:not(:last-child) td.palette-table__symbol::after {
  left: var(--space-4);
}

.palette-table thead th.palette-table__hidden::after,
.palette-table tbody tr:not(:last-child) td.palette-table__hidden::after {
  right: var(--space-4);
}

.palette-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  font-weight: var(--font-semibold);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.palette-table th.palette-table__symbol,
.palette-table td.palette-table__symbol,
.palette-table th.palette-table__color,
.palette-table td.palette-table__color,
.palette-table th.palette-table__select,
.palette-table td.palette-table__select,
.palette-table th.palette-table__hidden,
.palette-table td.palette-table__hidden {
  justify-content: center;
  text-align: center;
}

.palette-table td.palette-table__symbol {
  font-weight: var(--font-medium);
}
</style>
