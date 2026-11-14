<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { PaletteRow } from '../components/PaletteTable.vue'
import { hasOpenModal } from '../lib/modal-open'
import { formatSyncDiffMessage } from '../lib/sync-diff-message'
import { useAuthStore } from '../stores/auth'
import { useSchemeStore } from '../stores/scheme'

const { t, locale: i18nLocale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
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
  template,
  loadingScheme,
  schemeError,
  dirty,
  saving,
  lastSyncedAt,
  pendingConflict,
} = storeToRefs(schemeStore)

const codeQuery = ref('')
const bootError = ref('')
const leaveOpen = ref(false)
const leaveBusy = ref(false)
const conflictBusy = ref(false)

const CHROME_IDLE_MS = 3000
const chromeVisible = ref(true)
/** Курсор над островом chrome; на таче не используем (sticky hover). */
const chromePointerInside = ref(false)
let chromeIdleTimer: ReturnType<typeof setTimeout> | null = null

function canHoverChrome() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

const topRef = ref<HTMLElement | null>(null)
const modesRef = ref<HTMLElement | null>(null)
const navRef = ref<HTMLElement | null>(null)
/** Колонка, если горизонтальный ряд режимов не влезает рядом с nav. */
const modesStacked = ref(false)

let topResizeObserver: ResizeObserver | null = null

/** gap из computed; при column `column-gap` может быть 0 — берём положительный. */
function readGapPx(el: HTMLElement) {
  const styles = getComputedStyle(el)
  for (const raw of [styles.columnGap, styles.rowGap, styles.gap]) {
    const value = Number.parseFloat(raw)
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

/**
 * Ширина ряда кнопок: учитываем `display: contents` (UiModal) и gap между
 * реальными айтемами, а не DOM-обёртками с нулевой шириной.
 */
function measureRowWidth(el: HTMLElement) {
  const items: HTMLElement[] = []
  for (const kid of el.children) {
    const kidEl = kid as HTMLElement
    if (getComputedStyle(kidEl).display === 'contents') {
      for (const inner of kidEl.children) {
        items.push(inner as HTMLElement)
      }
    } else {
      items.push(kidEl)
    }
  }
  if (items.length === 0) return 0
  const gap = readGapPx(el)
  const widths = items.reduce((sum, item) => sum + item.offsetWidth, 0)
  return widths + gap * (items.length - 1)
}

function updateModesOrientation() {
  const top = topRef.value
  const modes = modesRef.value
  const nav = navRef.value
  if (!top || !modes || !nav) {
    modesStacked.value = false
    return
  }

  const gap = readGapPx(top)
  const available = top.clientWidth - nav.offsetWidth - gap
  modesStacked.value = measureRowWidth(modes) > available
}

function bindTopResizeObserver() {
  topResizeObserver?.disconnect()
  topResizeObserver = new ResizeObserver(() => {
    updateModesOrientation()
  })
  if (topRef.value) topResizeObserver.observe(topRef.value)
  if (modesRef.value) topResizeObserver.observe(modesRef.value)
  if (navRef.value) topResizeObserver.observe(navRef.value)
  updateModesOrientation()
}

function clearChromeIdleTimer() {
  if (!chromeIdleTimer) return
  clearTimeout(chromeIdleTimer)
  chromeIdleTimer = null
}

function scheduleChromeIdleHide() {
  clearChromeIdleTimer()
  if (hasOpenModal.value || chromePointerInside.value) return
  chromeIdleTimer = setTimeout(() => {
    if (hasOpenModal.value || chromePointerInside.value) return
    chromeVisible.value = false
    chromeIdleTimer = null
  }, CHROME_IDLE_MS)
}

/** Показать chrome и заново отсчитать idle до скрытия. */
function revealChrome() {
  chromeVisible.value = true
  scheduleChromeIdleHide()
}

function onChromePointerEnter() {
  if (!canHoverChrome()) return
  chromePointerInside.value = true
  chromeVisible.value = true
  clearChromeIdleTimer()
}

function onChromePointerLeave() {
  if (!canHoverChrome()) return
  chromePointerInside.value = false
  scheduleChromeIdleHide()
}

function onCardPointerDown() {
  // Тач: сбросить «залипший» inside, иначе idle может не стартовать.
  if (!canHoverChrome()) chromePointerInside.value = false
  revealChrome()
}

function onCardPointerMove(event: PointerEvent) {
  if (event.buttons === 0) return
  revealChrome()
}

function onCardWheel() {
  revealChrome()
}

const paletteRows = computed(() => {
  const data = template.value
  if (!data) return [] as Omit<PaletteRow, 'done'>[]
  const totals = new Array<number>(data.palette.length).fill(0)
  for (const paletteIndex of data.cells) {
    totals[paletteIndex]! += 1
  }
  return data.palette.map((entry, i) => ({
    ...entry,
    total: totals[i]!,
  }))
})

const paletteWithProgress = computed(() =>
  paletteRows.value.map((row) => ({
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

const conflictOpen = computed({
  get: () => Boolean(pendingConflict.value),
  set: (open: boolean) => {
    if (!open && pendingConflict.value) {
      schemeStore.pendingConflict = null
    }
  },
})

const syncStatusLabel = computed(() => {
  if (saving.value) return t('sync.saving')
  if (dirty.value) return t('sync.unsaved')
  if (!lastSyncedAt.value) return ''
  const time = new Date(lastSyncedAt.value).toLocaleTimeString(
    i18nLocale.value,
    { hour: '2-digit', minute: '2-digit' },
  )
  return t('sync.savedAt', { time })
})

const leaveMessage = computed(() => {
  const diff = schemeStore.unsavedDiff()
  return formatSyncDiffMessage(t, diff ? [diff] : [], 'sync.leaveAsk')
})

const conflictMessage = computed(() => {
  const conflict = pendingConflict.value
  if (!conflict) return t('sync.conflictAsk')
  return formatSyncDiffMessage(t, [conflict], 'sync.conflictAsk')
})

watchEffect(() => {
  document.title = t('app.title')
})

watch(
  template,
  async () => {
    await nextTick()
    bindTopResizeObserver()
    if (template.value) revealChrome()
  },
  { flush: 'post' },
)

watch(hasOpenModal, (open) => {
  if (open) {
    chromeVisible.value = true
    clearChromeIdleTimer()
    return
  }
  scheduleChromeIdleHide()
})

onMounted(async () => {
  bindTopResizeObserver()
  revealChrome()
  const schemeId = String(route.params.schemeId ?? '')
  const userId = auth.user?.id
  if (!schemeId || !userId) {
    bootError.value = t('scheme.loadError')
    return
  }
  try {
    await schemeStore.loadScheme(schemeId, userId)
  } catch {
    bootError.value = schemeError.value || t('scheme.loadError')
  }
})

onBeforeUnmount(() => {
  clearChromeIdleTimer()
  topResizeObserver?.disconnect()
  topResizeObserver = null
  schemeStore.unloadScheme()
})

function requestGallery() {
  if (dirty.value) {
    leaveOpen.value = true
    return
  }
  void router.push({ name: 'gallery' })
}

async function onLeaveSave() {
  leaveBusy.value = true
  try {
    const ok = await schemeStore.saveToServer({ force: true })
    if (!ok) return
    leaveOpen.value = false
    await router.push({ name: 'gallery' })
  } finally {
    leaveBusy.value = false
  }
}

function onLeaveDiscard() {
  leaveOpen.value = false
  void router.push({ name: 'gallery' })
}

async function onConflictKeepLocal() {
  conflictBusy.value = true
  try {
    await schemeStore.resolveConflict('local')
  } finally {
    conflictBusy.value = false
  }
}

async function onConflictUseServer() {
  conflictBusy.value = true
  try {
    await schemeStore.resolveConflict('server')
  } finally {
    conflictBusy.value = false
  }
}

function onConflictLater() {
  schemeStore.pendingConflict = null
}
</script>

<template>
  <div class="app-shell">
    <section
      class="app-card"
      :aria-label="t('app.schemeRegion')"
      @pointerdown="onCardPointerDown"
      @pointermove="onCardPointerMove"
      @wheel="onCardWheel"
    >
      <p v-if="loadingScheme" class="ui-status app-card__message">
        {{ t('common.loading') }}
      </p>
      <p v-else-if="bootError" class="ui-error app-card__message" role="alert">
        {{ bootError }}
      </p>
      <SchemeViewer v-else-if="template" />

      <div
        class="app-shell__chrome"
        :data-hidden="chromeVisible ? undefined : 'true'"
        @pointerenter="onChromePointerEnter"
        @pointerleave="onChromePointerLeave"
      >
        <div ref="topRef" class="app-shell__top">
          <div
            v-if="template"
            ref="modesRef"
            class="app-shell__island app-shell__island--modes"
            :data-stacked="modesStacked ? 'true' : undefined"
          >
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
              @click="
                schemeStore.updateStore({ showNavigator: !showNavigator })
              "
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

          <div ref="navRef" class="app-shell__island app-shell__island--nav">
            <SchemeSettings v-if="template" />
            <UiButton
              :aria-label="t('scheme.backToGallery')"
              @click="requestGallery"
            >
              <IconsAutoAwesomeMosaic />
            </UiButton>
          </div>
        </div>

        <div
          v-if="template && syncStatusLabel"
          class="app-shell__island app-shell__island--sync"
        >
          <span
            class="app-shell__sync-status"
            :data-dirty="dirty ? 'true' : undefined"
          >
            {{ syncStatusLabel }}
          </span>
        </div>
      </div>
    </section>

    <UiConfirmDialog
      v-model:open="leaveOpen"
      :title="t('sync.leaveTitle')"
      :message="leaveMessage"
      :confirm-label="t('sync.leaveSave')"
      :secondary-label="t('sync.leaveDiscard')"
      :cancel-label="t('sync.leaveCancel')"
      :busy="leaveBusy"
      @confirm="onLeaveSave"
      @secondary="onLeaveDiscard"
    />

    <UiConfirmDialog
      v-model:open="conflictOpen"
      :title="t('sync.conflictTitle')"
      :message="conflictMessage"
      :confirm-label="t('sync.conflictKeepLocal')"
      :secondary-label="t('sync.conflictUseServer')"
      :cancel-label="t('sync.conflictLater')"
      :busy="conflictBusy"
      @confirm="onConflictKeepLocal"
      @secondary="onConflictUseServer"
      @cancel="onConflictLater"
    />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100svh;
  padding: var(--space-2);
}

.app-shell__chrome {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-2);
  pointer-events: none;
  opacity: 1;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.app-shell__chrome[data-hidden='true'] {
  opacity: 0;
}

.app-shell__chrome[data-hidden='true'] .app-shell__island {
  pointer-events: none;
}

.app-shell__top {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.app-shell__island {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  pointer-events: auto;
}

.app-shell__island--modes {
  flex-direction: row;
  flex-wrap: nowrap;
}

.app-shell__island--modes[data-stacked='true'] {
  flex-direction: column;
  align-items: flex-start;
}

.app-shell__island--nav {
  margin-left: auto;
}

.app-shell__island--sync {
  align-self: flex-end;
}

.app-shell__sync-status {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.app-shell__sync-status[data-dirty='true'] {
  color: var(--color-text);
}

.app-card {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.app-card__message {
  margin: var(--space-4);
  padding-top: calc(var(--control-height) + var(--space-4));
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
