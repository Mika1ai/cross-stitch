import { BASE_CELL, MAX_CELL_PX, MIN_SCHEMES_IN_VIEW } from './constants'

export function indexAt(x: number, y: number, width: number) {
  return y * width + x
}

export function getFitScale(
  viewW: number,
  viewH: number,
  schemeWidth: number,
  schemeHeight: number,
) {
  const schemeW = schemeWidth * BASE_CELL
  const schemeH = schemeHeight * BASE_CELL
  // Меньшее отношение card/scheme — ось, по которой схема упирается в карточку.
  return Math.min(viewW / schemeW, viewH / schemeH)
}

export function getMinScale(
  viewW: number,
  viewH: number,
  schemeWidth: number,
  schemeHeight: number,
) {
  return (
    getFitScale(viewW, viewH, schemeWidth, schemeHeight) / MIN_SCHEMES_IN_VIEW
  )
}

export function getMaxScale() {
  // cellCssPx = BASE_CELL * scale → scale = MAX_CELL_PX / BASE_CELL
  return MAX_CELL_PX / BASE_CELL
}

export function clampScale(
  next: number,
  viewW: number,
  viewH: number,
  schemeWidth: number,
  schemeHeight: number,
) {
  const min = getMinScale(viewW, viewH, schemeWidth, schemeHeight)
  const max = Math.max(min, getMaxScale())
  return Math.min(max, Math.max(min, next))
}

export function clampAxis(pan: number, contentSize: number, viewSize: number) {
  // Центр карточки всегда над схемой → можно выехать за край примерно на половину кадра.
  const center = viewSize / 2
  const min = center - contentSize
  const max = center
  return Math.min(max, Math.max(min, pan))
}

export function visibleCellRange(
  cssW: number,
  cssH: number,
  panX: number,
  panY: number,
  scale: number,
  width: number,
  height: number,
) {
  const left = -panX / scale / BASE_CELL
  const top = -panY / scale / BASE_CELL
  const right = (cssW - panX) / scale / BASE_CELL
  const bottom = (cssH - panY) / scale / BASE_CELL
  return {
    x0: Math.max(0, Math.floor(left)),
    y0: Math.max(0, Math.floor(top)),
    x1: Math.min(width - 1, Math.ceil(right)),
    y1: Math.min(height - 1, Math.ceil(bottom)),
  }
}

export function clientToCell(
  clientX: number,
  clientY: number,
  root: DOMRect,
  panX: number,
  panY: number,
  scale: number,
  width: number,
  height: number,
) {
  const localX = clientX - root.left
  const localY = clientY - root.top
  const x = Math.floor((localX - panX) / scale / BASE_CELL)
  const y = Math.floor((localY - panY) / scale / BASE_CELL)
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  return { x, y, index: indexAt(x, y, width) }
}
