import { SCHEME_SETTINGS_DEFAULTS } from './scheme-settings-defaults'
import type { SchemeCellPos, UserProgressSettings } from '../types/database'

function mergeCellPos(value: unknown): SchemeCellPos | null {
  if (!value || typeof value !== 'object') return null
  const pos = value as Partial<SchemeCellPos>
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return null
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null
  return { x: pos.x, y: pos.y }
}

export function defaultProgressSettings(): UserProgressSettings {
  return {
    activeCodeColor: SCHEME_SETTINGS_DEFAULTS.activeCodeColor,
    gridSize: SCHEME_SETTINGS_DEFAULTS.gridSize,
    gridColor: SCHEME_SETTINGS_DEFAULTS.gridColor,
    cellDividerColor: SCHEME_SETTINGS_DEFAULTS.cellDividerColor,
    navigatorColor: SCHEME_SETTINGS_DEFAULTS.navigatorColor,
    navigatorSecondaryColor: SCHEME_SETTINGS_DEFAULTS.navigatorSecondaryColor,
    compassColor: SCHEME_SETTINGS_DEFAULTS.compassColor,
    compassSecondaryColor: SCHEME_SETTINGS_DEFAULTS.compassSecondaryColor,
    softenColorsOnZoom: SCHEME_SETTINGS_DEFAULTS.softenColorsOnZoom,
    veilColor: SCHEME_SETTINGS_DEFAULTS.veilColor,
    doneVeilColor: SCHEME_SETTINGS_DEFAULTS.doneVeilColor,
    washColor: SCHEME_SETTINGS_DEFAULTS.washColor,
    progressColor: SCHEME_SETTINGS_DEFAULTS.progressColor,
    activeCode: null,
    hiddenCodes: [],
    showBlocks: false,
    showNavigator: false,
    showCompass: false,
    showProgress: false,
    compassFrom: null,
    compassTo: null,
  }
}

export function mergeProgressSettings(
  raw: unknown,
): UserProgressSettings {
  const base = defaultProgressSettings()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<UserProgressSettings>
  return {
    ...base,
    ...input,
    hiddenCodes: Array.isArray(input.hiddenCodes)
      ? input.hiddenCodes.filter((c): c is string => typeof c === 'string')
      : base.hiddenCodes,
    activeCode:
      typeof input.activeCode === 'string' || input.activeCode === null
        ? input.activeCode
        : base.activeCode,
    showProgress:
      typeof input.showProgress === 'boolean'
        ? input.showProgress
        : base.showProgress,
    compassFrom: mergeCellPos(input.compassFrom),
    compassTo: mergeCellPos(input.compassTo),
  }
}
