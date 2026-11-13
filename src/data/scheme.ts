import schemeJson from './scheme.json'

export type SchemePaletteEntry = {
  color: string
  code: string
  symbol: string | null
  icon: string | null
}

export type SchemeData = {
  width: number
  height: number
  palette: SchemePaletteEntry[]
  /** Индексы в `palette`, длина `width * height`, порядок строк. */
  cells: number[]
}

/** Крупный JSON TS часто выводит как `{}` — задаём форму явно. */
export const schemeData = schemeJson as SchemeData

export function threadAt(cellIndex: number): SchemePaletteEntry {
  const paletteIndex = schemeData.cells[cellIndex]
  const entry = schemeData.palette[paletteIndex!]
  if (!entry) {
    throw new Error(`Missing palette entry for cell ${cellIndex}`)
  }
  return entry
}

export function coordsAt(cellIndex: number) {
  return {
    x: cellIndex % schemeData.width,
    y: Math.floor(cellIndex / schemeData.width),
  }
}
