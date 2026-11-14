import {
  computed,
  ref,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from 'vue'
import { defineStore } from 'pinia'
import type { SchemeData, SchemePaletteEntry } from '../types/scheme'
import { DEFAULT_LOCALE, i18n, type AppLocale } from '../i18n'
import {
  SCHEME_SETTINGS_DEFAULTS,
  type SchemeSettingsDefaults,
} from '../lib/scheme-settings-defaults'
import { defaultProgressSettings } from '../lib/progress-settings'
import {
  diffProgress,
  listDirtyProgress,
  progressContentOf,
  progressFingerprint,
  readLocalProgress,
  writeLocalProgress,
  type LocalProgressSnapshot,
  type ProgressContent,
  type ProgressDiff,
} from '../lib/progress-local'
import {
  ensureUserProgress,
  fetchScheme,
  saveUserProgress,
} from '../lib/schemes-api'
import type {
  SchemeCellPos,
  UserProgressSettings,
} from '../types/database'

export type { SchemeSettingsDefaults, SchemeCellPos }
export { SCHEME_SETTINGS_DEFAULTS }

export type ProgressConflict = ProgressDiff & {
  local: LocalProgressSnapshot
  server: LocalProgressSnapshot
}

export type { ProgressDiff }

const LOCALE_KEY = 'cross-stitch.locale'
const DARK_THEME_KEY = 'cross-stitch.darkTheme'
const SYNC_INTERVAL_MS = 10 * 60 * 1000

function readStoredLocale(): AppLocale {
  const raw = localStorage.getItem(LOCALE_KEY)
  return raw === 'en' || raw === 'ru' ? raw : DEFAULT_LOCALE
}

function readStoredDarkTheme(): boolean {
  const raw = localStorage.getItem(DARK_THEME_KEY)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return SCHEME_SETTINGS_DEFAULTS.darkTheme
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
  locale: AppLocale
}

export const useSchemeStore = defineStore('scheme', () => {
  const currentSchemeId = ref<string | null>(null)
  const currentUserId = ref<string | null>(null)
  const progressId = ref<string | null>(null)
  const template = shallowRef<SchemeData | null>(null)
  const loadingScheme = ref(false)
  const schemeError = ref<string | null>(null)
  const dirty = ref(false)
  const saving = ref(false)
  const lastSyncedAt = ref<string | null>(null)
  const pendingConflict = ref<ProgressConflict | null>(null)
  /** Последний сверенный с сервером контент (в памяти на время сессии схемы). */
  const syncedBaseline = shallowRef<ProgressContent | null>(null)

  let syncInterval: ReturnType<typeof setInterval> | null = null
  let persistSuspended = false
  let visibilityBound = false

  const done = shallowRef(new Set<number>())
  const lastDoneIndex = ref<number | null>(null)
  const locale = ref<AppLocale>(readStoredLocale())
  const activeCode = ref<string | null>(null)
  const hiddenCodes = shallowRef(new Set<string>())
  const activeCodeColor = ref(SCHEME_SETTINGS_DEFAULTS.activeCodeColor)
  const showBlocks = ref(false)
  const gridSize = ref(SCHEME_SETTINGS_DEFAULTS.gridSize)
  const gridColor = ref(SCHEME_SETTINGS_DEFAULTS.gridColor)
  const showNavigator = ref(false)
  const showCompass = ref(false)
  const compassFrom = ref<SchemeCellPos | null>(null)
  const compassTo = ref<SchemeCellPos | null>(null)
  const cellDividerColor = ref(SCHEME_SETTINGS_DEFAULTS.cellDividerColor)
  const navigatorColor = ref(SCHEME_SETTINGS_DEFAULTS.navigatorColor)
  const navigatorSecondaryColor = ref(
    SCHEME_SETTINGS_DEFAULTS.navigatorSecondaryColor,
  )
  const compassColor = ref(SCHEME_SETTINGS_DEFAULTS.compassColor)
  const compassSecondaryColor = ref(
    SCHEME_SETTINGS_DEFAULTS.compassSecondaryColor,
  )
  const darkTheme = ref(readStoredDarkTheme())
  const softenColorsOnZoom = ref(SCHEME_SETTINGS_DEFAULTS.softenColorsOnZoom)
  const veilColor = ref(SCHEME_SETTINGS_DEFAULTS.veilColor)
  const doneVeilColor = ref(SCHEME_SETTINGS_DEFAULTS.doneVeilColor)
  const washColor = ref(SCHEME_SETTINGS_DEFAULTS.washColor)
  const showProgress = ref(false)
  const progressColor = ref(SCHEME_SETTINGS_DEFAULTS.progressColor)
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
    const shouldPersist = (
      Object.keys(patch) as (keyof SchemeStorePatch)[]
    ).some((key) => key !== 'darkTheme' && key !== 'locale')
    if (shouldPersist) syncDirtyAndPersistLocal()
  }

  function threadAt(cellIndex: number): SchemePaletteEntry {
    const data = template.value
    if (!data) throw new Error('Scheme template is not loaded')
    const paletteIndex = data.cells[cellIndex]
    const entry = data.palette[paletteIndex!]
    if (!entry) {
      throw new Error(`Missing palette entry for cell ${cellIndex}`)
    }
    return entry
  }

  function coordsAt(cellIndex: number) {
    const data = template.value
    if (!data) throw new Error('Scheme template is not loaded')
    return {
      x: cellIndex % data.width,
      y: Math.floor(cellIndex / data.width),
    }
  }

  const doneCountByColor = computed(() => {
    const counts: Record<string, number> = {}
    const data = template.value
    if (!data) return counts
    for (const index of done.value) {
      if (data.cells[index] == null) continue
      const color = threadAt(index).color
      counts[color] = (counts[color] ?? 0) + 1
    }
    return counts
  })

  const activeColor = computed(() => {
    const code = activeCode.value
    const data = template.value
    if (!code || !data) return null
    const entry = data.palette.find((row) => row.code === code)
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

  function applyProgressSettings(settings: UserProgressSettings) {
    activeCodeColor.value = settings.activeCodeColor
    gridSize.value = settings.gridSize
    gridColor.value = settings.gridColor
    cellDividerColor.value = settings.cellDividerColor
    navigatorColor.value = settings.navigatorColor
    navigatorSecondaryColor.value = settings.navigatorSecondaryColor
    compassColor.value = settings.compassColor
    compassSecondaryColor.value = settings.compassSecondaryColor
    softenColorsOnZoom.value = settings.softenColorsOnZoom
    veilColor.value = settings.veilColor
    doneVeilColor.value = settings.doneVeilColor
    washColor.value = settings.washColor
    progressColor.value = settings.progressColor
    autoProgressOnZoomOut.value = settings.autoProgressOnZoomOut
    activeCode.value = settings.activeCode
    hiddenCodes.value = new Set(settings.hiddenCodes)
    showBlocks.value = settings.showBlocks
    showNavigator.value = settings.showNavigator
    showCompass.value = settings.showCompass
    showProgress.value = settings.showProgress
    compassFrom.value = settings.compassFrom
      ? { x: settings.compassFrom.x, y: settings.compassFrom.y }
      : null
    compassTo.value = settings.compassTo
      ? { x: settings.compassTo.x, y: settings.compassTo.y }
      : null
  }

  function collectProgressSettings(): UserProgressSettings {
    return {
      activeCodeColor: activeCodeColor.value,
      gridSize: gridSize.value,
      gridColor: gridColor.value,
      cellDividerColor: cellDividerColor.value,
      navigatorColor: navigatorColor.value,
      navigatorSecondaryColor: navigatorSecondaryColor.value,
      compassColor: compassColor.value,
      compassSecondaryColor: compassSecondaryColor.value,
      softenColorsOnZoom: softenColorsOnZoom.value,
      veilColor: veilColor.value,
      doneVeilColor: doneVeilColor.value,
      washColor: washColor.value,
      progressColor: progressColor.value,
      autoProgressOnZoomOut: autoProgressOnZoomOut.value,
      activeCode: activeCode.value,
      hiddenCodes: [...hiddenCodes.value],
      showBlocks: showBlocks.value,
      showNavigator: showNavigator.value,
      showCompass: showCompass.value,
      showProgress: showProgress.value,
      compassFrom: compassFrom.value
        ? { x: compassFrom.value.x, y: compassFrom.value.y }
        : null,
      compassTo: compassTo.value
        ? { x: compassTo.value.x, y: compassTo.value.y }
        : null,
    }
  }

  function currentContent(): ProgressContent {
    return {
      done: [...done.value],
      settings: collectProgressSettings(),
      lastDoneIndex: lastDoneIndex.value,
    }
  }

  function currentSnapshot(
    options: { dirty: boolean; lastSyncedAt: string | null },
  ): LocalProgressSnapshot {
    const content = currentContent()
    const baseline = syncedBaseline.value
    return {
      ...content,
      updatedAt: new Date().toISOString(),
      dirty: options.dirty,
      lastSyncedAt: options.lastSyncedAt,
      lastSynced: options.dirty
        ? baseline
          ? progressContentOf(baseline)
          : null
        : progressContentOf(content),
    }
  }

  function applySnapshot(snapshot: LocalProgressSnapshot) {
    done.value = new Set(snapshot.done)
    lastDoneIndex.value = snapshot.lastDoneIndex
    applyProgressSettings(snapshot.settings)
    dirty.value = snapshot.dirty
    lastSyncedAt.value = snapshot.lastSyncedAt
  }

  function setSyncedBaseline(content: ProgressContent) {
    syncedBaseline.value = progressContentOf(content)
  }

  function writeLocalNow() {
    const userId = currentUserId.value
    const schemeId = currentSchemeId.value
    if (!userId || !schemeId || persistSuspended) return
    writeLocalProgress(
      userId,
      schemeId,
      currentSnapshot({
        dirty: dirty.value,
        lastSyncedAt: lastSyncedAt.value,
      }),
    )
  }

  function isMeaningfulDiff(diff: ProgressDiff) {
    return diff.doneDiffers || diff.settingsDiffer
  }

  function unsavedDiff(): ProgressDiff | null {
    if (!dirty.value) return null
    const baseline = syncedBaseline.value
    if (!baseline) return null
    const diff = diffProgress(currentContent(), baseline)
    return isMeaningfulDiff(diff) ? diff : null
  }

  function dirtyDiffsForUser(userId: string): ProgressDiff[] {
    const diffs: ProgressDiff[] = []
    if (currentUserId.value === userId && dirty.value) {
      const current = unsavedDiff()
      if (current) diffs.push(current)
    }
    for (const entry of listDirtyProgress(userId)) {
      if (
        currentUserId.value === userId &&
        currentSchemeId.value === entry.schemeId
      ) {
        continue
      }
      if (!entry.snapshot.lastSynced) continue
      const diff = diffProgress(
        progressContentOf(entry.snapshot),
        entry.snapshot.lastSynced,
      )
      if (isMeaningfulDiff(diff)) diffs.push(diff)
    }
    return diffs
  }

  /** dirty только если контент реально отличается от последнего sync. */
  function syncDirtyAndPersistLocal() {
    if (persistSuspended || !progressId.value) return
    const baseline = syncedBaseline.value
    dirty.value = baseline
      ? progressFingerprint(currentContent()) !==
        progressFingerprint(baseline)
      : true
    writeLocalNow()
  }

  async function saveToServer(options?: { force?: boolean }) {
    if (!progressId.value || !currentUserId.value || !currentSchemeId.value) {
      return false
    }
    if (!options?.force && !dirty.value) return true
    if (saving.value) return false

    saving.value = true
    try {
      await saveUserProgress({
        progressId: progressId.value,
        done: [...done.value],
        settings: collectProgressSettings(),
        lastDoneIndex: lastDoneIndex.value,
      })
      dirty.value = false
      lastSyncedAt.value = new Date().toISOString()
      setSyncedBaseline(currentContent())
      writeLocalNow()
      return true
    } catch (e) {
      console.error('[scheme] failed to save progress', e)
      return false
    } finally {
      saving.value = false
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'hidden') return
    writeLocalNow()
    if (dirty.value) void saveToServer()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    writeLocalNow()
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  function startSessionGuards() {
    if (visibilityBound) return
    visibilityBound = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    syncInterval = setInterval(() => {
      if (dirty.value) void saveToServer()
    }, SYNC_INTERVAL_MS)
  }

  function stopSessionGuards() {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
    if (visibilityBound) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
      visibilityBound = false
    }
  }

  function unloadScheme() {
    stopSessionGuards()
    persistSuspended = true
    pendingConflict.value = null
    syncedBaseline.value = null
    currentSchemeId.value = null
    currentUserId.value = null
    progressId.value = null
    template.value = null
    dirty.value = false
    lastSyncedAt.value = null
    done.value = new Set()
    lastDoneIndex.value = null
    applyProgressSettings(defaultProgressSettings())
    persistSuspended = false
  }

  async function loadScheme(schemeId: string, userId: string) {
    loadingScheme.value = true
    schemeError.value = null
    persistSuspended = true
    pendingConflict.value = null
    stopSessionGuards()
    try {
      const scheme = await fetchScheme(schemeId)
      if (!scheme) {
        throw new Error('Scheme not found')
      }

      const progress = await ensureUserProgress(userId, schemeId)
      const serverContent = progressContentOf({
        done: progress.done,
        settings: progress.settings,
        lastDoneIndex: progress.last_done_index,
      })
      const serverSnap: LocalProgressSnapshot = {
        ...serverContent,
        updatedAt: progress.updated_at,
        dirty: false,
        lastSyncedAt: progress.updated_at,
        lastSynced: serverContent,
      }
      const local = readLocalProgress(userId, scheme.id)

      currentUserId.value = userId
      currentSchemeId.value = scheme.id
      progressId.value = progress.id
      template.value = {
        width: scheme.width,
        height: scheme.height,
        palette: scheme.palette,
        cells: scheme.cells,
      }
      setSyncedBaseline(serverContent)

      if (
        local &&
        progressFingerprint(local) !== progressFingerprint(serverSnap)
      ) {
        const diff = diffProgress(local, serverSnap)
        pendingConflict.value = {
          ...diff,
          local,
          server: serverSnap,
        }
        // Temporary hydrate from local draft until user chooses
        const draft: LocalProgressSnapshot = {
          ...local,
          dirty: true,
          updatedAt: new Date().toISOString(),
          lastSynced: serverContent,
        }
        applySnapshot(draft)
        writeLocalProgress(userId, scheme.id, draft)
      } else if (local) {
        const hydrated: LocalProgressSnapshot = {
          ...local,
          dirty: local.dirty,
          lastSyncedAt: local.lastSyncedAt ?? serverSnap.lastSyncedAt,
          lastSynced: local.lastSynced ?? serverContent,
        }
        applySnapshot(hydrated)
        if (hydrated.lastSynced) setSyncedBaseline(hydrated.lastSynced)
        writeLocalProgress(userId, scheme.id, hydrated)
      } else {
        applySnapshot(serverSnap)
        writeLocalProgress(userId, scheme.id, serverSnap)
      }

      startSessionGuards()
    } catch (e) {
      schemeError.value = e instanceof Error ? e.message : 'Load failed'
      throw e
    } finally {
      persistSuspended = false
      loadingScheme.value = false
    }
  }

  async function resolveConflict(choice: 'local' | 'server') {
    const conflict = pendingConflict.value
    if (!conflict) return
    persistSuspended = true
    if (choice === 'local') {
      applySnapshot({
        ...conflict.local,
        dirty: true,
        lastSynced: progressContentOf(conflict.server),
      })
      setSyncedBaseline(conflict.server)
      persistSuspended = false
      pendingConflict.value = null
      writeLocalNow()
      await saveToServer({ force: true })
      return
    }
    applySnapshot({
      ...conflict.server,
      dirty: false,
      lastSynced: progressContentOf(conflict.server),
    })
    setSyncedBaseline(conflict.server)
    persistSuspended = false
    pendingConflict.value = null
    writeLocalNow()
  }

  /** Сброс per-scheme настроек (не darkTheme / locale). */
  function resetSchemeSettings() {
    const defaults = defaultProgressSettings()
    updateStore({
      activeCodeColor: defaults.activeCodeColor,
      gridSize: defaults.gridSize,
      gridColor: defaults.gridColor,
      cellDividerColor: defaults.cellDividerColor,
      navigatorColor: defaults.navigatorColor,
      navigatorSecondaryColor: defaults.navigatorSecondaryColor,
      compassColor: defaults.compassColor,
      compassSecondaryColor: defaults.compassSecondaryColor,
      softenColorsOnZoom: defaults.softenColorsOnZoom,
      veilColor: defaults.veilColor,
      doneVeilColor: defaults.doneVeilColor,
      washColor: defaults.washColor,
      progressColor: defaults.progressColor,
      autoProgressOnZoomOut: defaults.autoProgressOnZoomOut,
    })
  }

  function userHasUnsavedProgress(userId: string) {
    if (currentUserId.value === userId && dirty.value) {
      if (unsavedDiff()) return true
    }
    return dirtyDiffsForUser(userId).length > 0
  }

  /** Push every dirty local draft for this user (e.g. before sign-out). */
  async function flushAllDirtyForUser(userId: string) {
    if (currentUserId.value === userId && dirty.value) {
      const ok = await saveToServer({ force: true })
      if (!ok) return false
    }

    const dirtyList = listDirtyProgress(userId)
    for (const entry of dirtyList) {
      if (
        currentUserId.value === userId &&
        currentSchemeId.value === entry.schemeId
      ) {
        continue
      }
      try {
        const progress = await ensureUserProgress(userId, entry.schemeId)
        await saveUserProgress({
          progressId: progress.id,
          done: entry.snapshot.done,
          settings: entry.snapshot.settings,
          lastDoneIndex: entry.snapshot.lastDoneIndex,
        })
        const syncedAt = new Date().toISOString()
        const content = progressContentOf(entry.snapshot)
        writeLocalProgress(userId, entry.schemeId, {
          ...entry.snapshot,
          dirty: false,
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
          lastSynced: content,
        })
      } catch (e) {
        console.error('[scheme] failed to flush dirty progress', e)
        return false
      }
    }
    return true
  }

  watch(
    darkTheme,
    (on) => {
      document.documentElement.dataset.theme = on ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', on ? '#161514' : '#f7f6f4')
      localStorage.setItem(DARK_THEME_KEY, String(on))
    },
    { immediate: true },
  )

  watch(
    locale,
    (code) => {
      i18n.global.locale.value = code
      document.documentElement.lang = code
      localStorage.setItem(LOCALE_KEY, code)
    },
    { immediate: true },
  )

  return {
    currentSchemeId,
    currentUserId,
    progressId,
    template,
    loadingScheme,
    schemeError,
    dirty,
    saving,
    lastSyncedAt,
    pendingConflict,
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
    threadAt,
    coordsAt,
    loadScheme,
    unloadScheme,
    resetSchemeSettings,
    saveToServer,
    resolveConflict,
    userHasUnsavedProgress,
    dirtyDiffsForUser,
    unsavedDiff,
    flushAllDirtyForUser,
    writeLocalNow,
  }
})
