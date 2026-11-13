export type FaIconGlyph = {
  unicode: string
  char: string
  weight: number
}

export type NavSegment = {
  axis: 'horizontal' | 'vertical'
  dir: 'up' | 'down' | 'left' | 'right'
  count: number
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export type NavRoute = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  corner: { x: number; y: number }
  segments: NavSegment[]
}

export type CellFrame = {
  x: number
  y: number
  color: string
  dashed: boolean
}
