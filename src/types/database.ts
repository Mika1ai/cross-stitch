import type { AppLocale } from '../i18n'
import type { SchemePaletteEntry } from './scheme'

export type SchemeCellPos = { x: number; y: number }

/** App-global prefs in user_settings.prefs (one row per user). */
export type UserSettingsPrefs = {
  locale: AppLocale
  darkTheme: boolean
  markDoneOnSingleTap: boolean
}

/** Per-scheme UI + work state stored in user_progress.settings */
export type UserProgressSettings = {
  activeCodeColor: string
  gridSize: number
  gridColor: string
  cellDividerColor: string
  navigatorColor: string
  navigatorSecondaryColor: string
  compassColor: string
  compassSecondaryColor: string
  softenColorsOnZoom: boolean
  veilColor: string
  doneVeilColor: string
  washColor: string
  progressColor: string
  autoProgressOnZoomOut: boolean
  activeCode: string | null
  hiddenCodes: string[]
  showBlocks: boolean
  showNavigator: boolean
  showCompass: boolean
  showProgress: boolean
  compassFrom: SchemeCellPos | null
  compassTo: SchemeCellPos | null
}

export type UserSettingsRow = {
  user_id: string
  prefs: UserSettingsPrefs
  updated_at: string
}

export type SchemeRow = {
  id: string
  slug: string
  title: string
  preview_path: string | null
  width: number
  height: number
  palette: SchemePaletteEntry[]
  cells: number[]
  created_at: string
}

export type SchemeListItem = Pick<
  SchemeRow,
  'id' | 'title' | 'preview_path' | 'width' | 'height'
>

export type UserProgressRow = {
  id: string
  user_id: string
  scheme_id: string
  done: number[]
  settings: UserProgressSettings
  last_done_index: number | null
  updated_at: string
}
