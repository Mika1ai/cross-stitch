import { BASE_CELL } from './constants'
import type { NavRoute, NavSegment } from './types'

export function cellCenter(x: number, y: number) {
  return {
    x: x * BASE_CELL + BASE_CELL / 2,
    y: y * BASE_CELL + BASE_CELL / 2,
  }
}

export function buildRouteBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
): NavRoute | null {
  if (from.x === to.x && from.y === to.y) return null

  // Г-путь: сначала по вертикали, потом по горизонтали
  const corner = { x: from.x, y: to.y }
  const segments: NavSegment[] = []

  const dy = to.y - from.y
  if (dy !== 0) {
    segments.push({
      axis: 'vertical',
      dir: dy > 0 ? 'down' : 'up',
      count: Math.abs(dy),
      from: { x: from.x, y: from.y },
      to: { x: corner.x, y: corner.y },
    })
  }

  const dx = to.x - from.x
  if (dx !== 0) {
    segments.push({
      axis: 'horizontal',
      dir: dx > 0 ? 'right' : 'left',
      count: Math.abs(dx),
      from: { x: corner.x, y: corner.y },
      to: { x: to.x, y: to.y },
    })
  }

  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    corner,
    segments,
  }
}

export function buildNavRouteFromDone(
  fromIndex: number,
  cellsLength: number,
  done: Set<number>,
  indicesByColor: Map<string, number[]>,
  coordsAt: (index: number) => { x: number; y: number },
  colorAt: (index: number) => string,
): NavRoute | null {
  if (fromIndex < 0 || fromIndex >= cellsLength) return null
  const from = coordsAt(fromIndex)
  const fromColor = colorAt(fromIndex).toLowerCase()

  const candidates = indicesByColor.get(fromColor) ?? []
  let bestIndex = -1
  let bestDist = Number.POSITIVE_INFINITY

  for (const index of candidates) {
    if (index === fromIndex || done.has(index)) continue
    const to = coordsAt(index)
    const dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    if (dist > 0 && dist < bestDist) {
      bestDist = dist
      bestIndex = index
    }
  }

  if (bestIndex < 0) return null
  return buildRouteBetween(from, coordsAt(bestIndex))
}
