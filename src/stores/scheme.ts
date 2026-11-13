import { computed, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import { defineStore } from 'pinia'
import { schemeData, threadAt } from '../data/scheme'
import {
  DEFAULT_LOCALE,
  i18n,
  type AppLocale,
} from '../i18n'

export type SchemeCellPos = { x: number; y: number }

/** Дефолты полей из модалки «Настройки» (сброс через updateStore). */
export type SchemeSettingsDefaults = {
  activeCodeColor: string
  gridSize: number
  gridColor: string
  cellDividerColor: string
  navigatorColor: string
  navigatorSecondaryColor: string
  compassColor: string
  compassSecondaryColor: string
  darkTheme: boolean
  softenColorsOnZoom: boolean
  veilColor: string
  doneVeilColor: string
  washColor: string
  progressColor: string
  autoProgressOnZoomOut: boolean
}

export const SCHEME_SETTINGS_DEFAULTS: SchemeSettingsDefaults = {
  // Акценты тулбара: один OKLab L как у activeCode (#e11d48), оттенки сохранены
  activeCodeColor: '#e11d48ff',
  gridSize: 10,
  gridColor: '#898000ff',
  cellDividerColor: '#0000002e',
  navigatorColor: '#00963dff',
  navigatorSecondaryColor: '#f7f6f4ff',
  compassColor: '#884bfdff',
  compassSecondaryColor: '#f7f6f4ff',
  darkTheme: true,
  softenColorsOnZoom: true,
  veilColor: '#141414bf',
  doneVeilColor: '#141414bf',
  washColor: '#141414bf',
  progressColor: '#0b8f89ff',
  autoProgressOnZoomOut: false,
}

/** Поля, которые можно патчить через updateStore. */
export type SchemeStorePatch = {
  done: Set<number>
  lastDoneIndex: number | null
  activeCode: string | null
  hiddenCodes: Set<string>
  activeCodeColor: string
  showBlocks: boolean
  gridSize: number
  gridColor: string
  showNavigator: boolean
  showCompass: boolean
  compassFrom: SchemeCellPos | null
  compassTo: SchemeCellPos | null
  cellDividerColor: string
  navigatorColor: string
  navigatorSecondaryColor: string
  compassColor: string
  compassSecondaryColor: string
  darkTheme: boolean
  softenColorsOnZoom: boolean
  veilColor: string
  doneVeilColor: string
  washColor: string
  showProgress: boolean
  progressColor: string
  autoProgressOnZoomOut: boolean
  /** Язык UI (`ru` / `en`). Не входит в reset настроек схемы. */
  locale: AppLocale
}

export const useSchemeStore = defineStore('scheme', () => {
  const done = shallowRef(new Set<number>())
  const lastDoneIndex = ref<number | null>(null)
  /** Язык интерфейса. */
  const locale = ref<AppLocale>(DEFAULT_LOCALE)
  /** Активная нитка в ключе — по коду (highlight на схеме). */
  const activeCode = ref<string | null>(null)
  /**
   * Скрытые коды: не в общем прогрессе, нельзя mark done.
   * Уже лежащие в `done` не чистим — только не рисуем как сделанные.
   */
  const hiddenCodes = shallowRef(new Set<string>())
  /** Цвет обводки/маркера активного кода (настраиваемый). Формат: #RRGGBBAA. */
  const activeCodeColor = ref(SCHEME_SETTINGS_DEFAULTS.activeCodeColor)
  /** Показ блок-сетки на схеме. */
  const showBlocks = ref(false)
  /** Размер блока сетки (клеток), по умолчанию 10×10. */
  const gridSize = ref(SCHEME_SETTINGS_DEFAULTS.gridSize)
  /** Цвет линий блок-сетки. */
  const gridColor = ref(SCHEME_SETTINGS_DEFAULTS.gridColor)
  /** Режим навигатора. */
  const showNavigator = ref(false)
  /** Режим компаса. */
  const showCompass = ref(false)
  /** Первая точка компаса (как lastDoneIndex для навигатора). */
  const compassFrom = ref<SchemeCellPos | null>(null)
  /** Вторая точка компаса. */
  const compassTo = ref<SchemeCellPos | null>(null)
  /** Цвет мелкой разлиновки клеток (разделение). */
  const cellDividerColor = ref(SCHEME_SETTINGS_DEFAULTS.cellDividerColor)
  /** Цвет маршрута навигатора. */
  const navigatorColor = ref(SCHEME_SETTINGS_DEFAULTS.navigatorColor)
  /** Фон плашек с цифрами на пути навигатора. */
  const navigatorSecondaryColor = ref(
    SCHEME_SETTINGS_DEFAULTS.navigatorSecondaryColor,
  )
  /** Цвет маршрута компаса. */
  const compassColor = ref(SCHEME_SETTINGS_DEFAULTS.compassColor)
  /** Фон плашек с цифрами на пути компаса. */
  const compassSecondaryColor = ref(
    SCHEME_SETTINGS_DEFAULTS.compassSecondaryColor,
  )
  /** Тёмная тема UI (`data-theme="dark"` на `<html>`). */
  const darkTheme = ref(SCHEME_SETTINGS_DEFAULTS.darkTheme)
  /**
   * При зуме приглушать заливку клеток (wash),
   * чтобы символы читались на контрастных соседних цветах.
   */
  const softenColorsOnZoom = ref(SCHEME_SETTINGS_DEFAULTS.softenColorsOnZoom)
  /** Цвет focus-veil (навигатор/компас). */
  const veilColor = ref(SCHEME_SETTINGS_DEFAULTS.veilColor)
  /** Затемнение готовой клетки (поверх цвета и символа). */
  const doneVeilColor = ref(SCHEME_SETTINGS_DEFAULTS.doneVeilColor)
  /** Цвет zoom-wash (приглушение при зуме). */
  const washColor = ref(SCHEME_SETTINGS_DEFAULTS.washColor)
  /** Режим прогресса: done перекрашены в colorCanvas. */
  const showProgress = ref(false)
  /** Цвет done в режиме прогресса (перекраска в colorCanvas). */
  const progressColor = ref(SCHEME_SETTINGS_DEFAULTS.progressColor)
  /**
   * Авто: при cellPx < порога крестиков включать прогресс,
   * при возврате выше порога — выключать.
   */
  const autoProgressOnZoomOut = ref(
    SCHEME_SETTINGS_DEFAULTS.autoProgressOnZoomOut,
  )

  const patchable = {
    done,
    lastDoneIndex,
    activeCode,
    hiddenCodes,
    activeCodeColor,
    showBlocks,
    gridSize,
    gridColor,
    showNavigator,
    showCompass,
    compassFrom,
    compassTo,
    cellDividerColor,
    navigatorColor,
    navigatorSecondaryColor,
    compassColor,
    compassSecondaryColor,
    darkTheme,
    softenColorsOnZoom,
    veilColor,
    doneVeilColor,
    washColor,
    showProgress,
    progressColor,
    autoProgressOnZoomOut,
    locale,
  } as const satisfies {
    [K in keyof SchemeStorePatch]:
      | Ref<SchemeStorePatch[K]>
      | ShallowRef<SchemeStorePatch[K]>
  }

  function updateStore(patch: Partial<SchemeStorePatch>) {
    for (const key of Object.keys(patch) as (keyof SchemeStorePatch)[]) {
      const value = patch[key]
      if (value !== undefined) {
        ;(patchable[key] as { value: unknown }).value = value
      }
    }
  }

  const doneCountByColor = computed(() => {
    const counts: Record<string, number> = {}
    for (const index of done.value) {
      if (schemeData.cells[index] == null) continue
      const color = threadAt(index).color
      counts[color] = (counts[color] ?? 0) + 1
    }
    return counts
  })

  const activeColor = computed(() => {
    const code = activeCode.value
    if (!code) return null
    const entry = schemeData.palette.find((row) => row.code === code)
    return entry?.color ?? null
  })

  function toggleCell(index: number) {
    const next = new Set(done.value)
    let nextLast = lastDoneIndex.value
    if (next.has(index)) {
      next.delete(index)
      if (nextLast === index) nextLast = null
    } else {
      next.add(index)
      nextLast = index
    }
    updateStore({ done: next, lastDoneIndex: nextLast })
  }

  function toggleActiveCode(code: string) {
    updateStore({
      activeCode: activeCode.value === code ? null : code,
    })
  }

  function setCodeHidden(code: string, hidden: boolean) {
    const has = hiddenCodes.value.has(code)
    if (hidden === has) return
    const next = new Set(hiddenCodes.value)
    if (hidden) next.add(code)
    else next.delete(code)
    updateStore({ hiddenCodes: next })
  }

  watch(
    darkTheme,
    (on) => {
      document.documentElement.dataset.theme = on ? 'dark' : 'light'
    },
    { immediate: true },
  )

  watch(
    locale,
    (code) => {
      i18n.global.locale.value = code
      document.documentElement.lang = code
    },
    { immediate: true },
  )

  return {
    done,
    lastDoneIndex,
    activeCode,
    hiddenCodes,
    locale,
    activeCodeColor,
    showBlocks,
    gridSize,
    gridColor,
    showNavigator,
    showCompass,
    compassFrom,
    compassTo,
    cellDividerColor,
    navigatorColor,
    navigatorSecondaryColor,
    compassColor,
    compassSecondaryColor,
    darkTheme,
    softenColorsOnZoom,
    veilColor,
    doneVeilColor,
    washColor,
    showProgress,
    progressColor,
    autoProgressOnZoomOut,
    activeColor,
    doneCountByColor,
    updateStore,
    toggleCell,
    toggleActiveCode,
    setCodeHidden,
  }
})
