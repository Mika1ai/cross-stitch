import { tinycolor } from 'vue-color'
import type { SchemePaletteEntry } from '../../data/scheme'
import { BASE_CELL, DONE_MARK_MIN_CELL_PX, FRAME_TINT_ALPHA } from './constants'

export function parseHexRgb(hex: string) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ] as const
}

export function frameTintFill(color: string) {
  const { r, g, b } = tinycolor(color).toRgb()
  return `rgba(${r}, ${g}, ${b}, ${FRAME_TINT_ALPHA})`
}

export function contrastInk(bg: string) {
  const { r, g, b } = tinycolor(bg).toRgb()
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luma > 0.55 ? '#000000' : '#ffffff'
}

/** Фон клетки после наложения wash (для выбора чёрной/белой иконки). */
export function blendOver(baseColor: string, overlayRgba: string | null) {
  if (!overlayRgba) return baseColor
  const base = tinycolor(baseColor).toRgb()
  const over = tinycolor(overlayRgba).toRgb()
  const a = over.a
  return tinycolor({
    r: Math.round(over.r * a + base.r * (1 - a)),
    g: Math.round(over.g * a + base.g * (1 - a)),
    b: Math.round(over.b * a + base.b * (1 - a)),
  }).toHexString()
}

/**
 * Zoom-wash: RGB и max-alpha из `washColor`;
 * alpha 0…a от cellPx=DONE_MARK_MIN до max zoom.
 */
export function softWashFill(options: {
  enabled: boolean
  washColor: string
  scale: number
  maxScale: number
}): string | null {
  if (!options.enabled) return null
  const start = DONE_MARK_MIN_CELL_PX / BASE_CELL
  const max = options.maxScale
  if (max <= start) return null
  const t = Math.min(1, Math.max(0, (options.scale - start) / (max - start)))
  if (t <= 0) return null
  const { r, g, b, a } = tinycolor(options.washColor).toRgb()
  return `rgba(${r}, ${g}, ${b}, ${t * a})`
}

export function buildInkTable(
  palette: SchemePaletteEntry[],
  wash: string | null,
): string[] {
  return palette.map((entry) => contrastInk(blendOver(entry.color, wash)))
}

export function buildColorCanvas(options: {
  width: number
  height: number
  cells: number[]
  palette: SchemePaletteEntry[]
  done: Set<number>
  hiddenCodes: Set<string>
  showProgress: boolean
  progressColor: string
}): HTMLCanvasElement {
  const {
    width,
    height,
    cells,
    palette,
    done,
    hiddenCodes,
    showProgress,
    progressColor,
  } = options
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const image = ctx.createImageData(width, height)
  const data = image.data
  const rgbByPalette = palette.map((entry) => parseHexRgb(entry.color))
  const hiddenPalette = new Set(
    palette.flatMap((entry, i) => (hiddenCodes.has(entry.code) ? [i] : [])),
  )
  const progressRgb = showProgress ? parseHexRgb(progressColor) : null

  for (let i = 0; i < cells.length; i++) {
    const paletteIndex = cells[i]!
    const asProgress =
      progressRgb && done.has(i) && !hiddenPalette.has(paletteIndex)
    const rgb = asProgress ? progressRgb : rgbByPalette[paletteIndex]!
    const o = i * 4
    data[o] = rgb[0]
    data[o + 1] = rgb[1]
    data[o + 2] = rgb[2]
    data[o + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
