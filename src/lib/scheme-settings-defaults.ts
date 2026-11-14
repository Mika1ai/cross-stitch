/** Дефолты полей из модалки «Настройки» (сброс / seed progress.settings). */
export type SchemeSettingsDefaults = {
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
  softenColorsOnZoom: true,
  veilColor: '#141414bf',
  doneVeilColor: '#141414bf',
  washColor: '#141414bf',
  progressColor: '#0b8f89ff',
}
