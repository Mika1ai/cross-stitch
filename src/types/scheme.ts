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
