<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { PaletteRow } from './components/PaletteTable.vue'
import { schemeData } from './data/scheme'
import { useSchemeStore } from './stores/scheme'

function buildPaletteRows(): Omit<PaletteRow, 'done'>[] {
  const totals = new Array<number>(schemeData.palette.length).fill(0)
  for (const paletteIndex of schemeData.cells) {
    totals[paletteIndex]! += 1
  }
  return schemeData.palette.map((entry, i) => ({
    ...entry,
    total: totals[i]!,
  }))
}

const { t } = useI18n()
const paletteRows = buildPaletteRows()
const schemeStore = useSchemeStore()
const {
  doneCountByColor,
  activeCode,
  activeCodeColor,
  hiddenCodes,
  showBlocks,
  gridColor,
  showNavigator,
  navigatorColor,
  showCompass,
  compassColor,
  showProgress,
  progressColor,
} = storeToRefs(schemeStore)

const codeQuery = ref('')

const paletteWithProgress = computed(() =>
  paletteRows.map((row) => ({
    ...row,
    done: doneCountByColor.value[row.color] ?? 0,
  })),
)

const filteredPaletteRows = computed(() => {
  const query = codeQuery.value.trim()
  if (!query) return paletteWithProgress.value
  return paletteWithProgress.value.filter((row) => row.code.includes(query))
})

const overallProgress = computed(() => {
  const visible = paletteWithProgress.value.filter(
    (row) => !hiddenCodes.value.has(row.code),
  )
  const done = visible.reduce((sum, row) => sum + row.done, 0)
  const total = visible.reduce((sum, row) => sum + row.total, 0)
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return `${done}/${total} (${percent}%)`
})

watchEffect(() => {
  document.title = t('app.title')
})
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div class="app-shell__actions">
        <div class="app-shell__actions-start">
          <UiModal :title="t('palette.title')">
            <template #trigger>
              <UiButton
                :aria-label="t('toolbar.palette')"
                :aria-pressed="Boolean(activeCode)"
                :color="activeCodeColor"
              >
                <IconsPalette />
              </UiButton>
            </template>

            <div class="palette-toolbar">
              <UiInput
                v-model="codeQuery"
                class="palette-search"
                search
                inputmode="numeric"
                :pattern="/^[0-9-]*$/"
                :placeholder="t('palette.searchPlaceholder')"
                autocomplete="off"
                :aria-label="t('palette.searchAria')"
              />

              <p class="palette-overall">{{ overallProgress }}</p>
            </div>

            <PaletteTable :rows="filteredPaletteRows" />
          </UiModal>

          <UiButton
            :aria-label="t('toolbar.blockGrid')"
            :aria-pressed="showBlocks"
            :color="gridColor"
            @click="schemeStore.updateStore({ showBlocks: !showBlocks })"
          >
            <IconsGrid3x3 />
          </UiButton>

          <UiButton
            :aria-label="t('toolbar.navigator')"
            :aria-pressed="showNavigator"
            :color="navigatorColor"
            @click="schemeStore.updateStore({ showNavigator: !showNavigator })"
          >
            <IconsNavigation />
          </UiButton>

          <UiButton
            :aria-label="t('toolbar.compass')"
            :aria-pressed="showCompass"
            :color="compassColor"
            @click="schemeStore.updateStore({ showCompass: !showCompass })"
          >
            <IconsExplore />
          </UiButton>

          <UiButton
            :aria-label="t('toolbar.progress')"
            :aria-pressed="showProgress"
            :color="progressColor"
            @click="schemeStore.updateStore({ showProgress: !showProgress })"
          >
            <IconsClockLoader40 />
          </UiButton>
        </div>

        <div class="app-shell__actions-end">
          <SchemeSettings />
        </div>
      </div>
    </header>

    <section class="app-card" :aria-label="t('app.schemeRegion')">
      <SchemeViewer />
    </section>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100svh;
  padding: var(--space-2);
  gap: var(--space-2);
}

.app-shell__header {
  flex-shrink: 0;
}

.app-shell__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.app-shell__actions-start,
.app-shell__actions-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.app-card {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.palette-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.palette-search {
  width: 8rem;
}

.palette-overall {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--color-text);
  white-space: nowrap;
}
</style>
