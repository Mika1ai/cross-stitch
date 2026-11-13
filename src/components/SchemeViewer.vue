<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { tinycolor } from 'vue-color'
import faIconMap from '../data/fa-icon-map.json'
import {
  schemeData,
  threadAt,
  type SchemePaletteEntry,
} from '../data/scheme'
import { useSchemeStore } from '../stores/scheme'
import {
  ACCENT_STROKE_CSS_PX,
  ACCENT_STROKE_MIN,
  BASE_CELL,
  DBL_TAP_MS,
  DONE_MARK_MIN_CELL_PX,
  LONG_PRESS_MS,
  ORIENT_HIDE_MS,
  ORIENT_MIN_THUMB_PX,
  TAP_MOVE_PX,
} from './scheme-viewer/constants'
import {
  buildColorCanvas as buildColorCanvasBitmap,
  buildInkTable,
  frameTintFill,
  softWashFill as softWashFillAt,
} from './scheme-viewer/color'
import {
  clampAxis,
  clampScale as clampScaleAt,
  clientToCell as clientToCellAt,
  getFitScale as getFitScaleAt,
  getMaxScale,
  indexAt as indexAtXY,
  visibleCellRange as visibleCellRangeAt,
} from './scheme-viewer/geometry'
import {
  buildNavRouteFromDone as buildNavRouteFromDoneAt,
  buildRouteBetween,
  cellCenter,
} from './scheme-viewer/routes'
import type {
  CellFrame,
  FaIconGlyph,
  NavRoute,
  NavSegment,
} from './scheme-viewer/types'

const iconGlyphs = faIconMap as Record<string, FaIconGlyph>

const schemeStore = useSchemeStore()
const {
  done,
  lastDoneIndex,
  activeCode,
  activeCodeColor,
  hiddenCodes,
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
} = storeToRefs(schemeStore)

const width = schemeData.width
const height = schemeData.height
const cells = schemeData.cells
const palette = schemeData.palette

function accentStrokeWidth() {
  return Math.max(ACCENT_STROKE_CSS_PX / scale.value, ACCENT_STROKE_MIN)
}

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const orientRailVRef = ref<HTMLElement | null>(null)
const orientRailHRef = ref<HTMLElement | null>(null)

const scale = ref(1)
const panX = ref(0)
const panY = ref(0)

const orientActive = ref(false)
const orientV = ref({ show: false, top: 0, height: 0 })
const orientH = ref({ show: false, left: 0, width: 0 })
let orientHideTimer: ReturnType<typeof setTimeout> | null = null

const indicesByColor = new Map<string, number[]>()
for (let i = 0; i < cells.length; i++) {
  const key = threadAt(i).color.toLowerCase()
  const list = indicesByColor.get(key)
  if (list) list.push(i)
  else indicesByColor.set(key, [i])
}

const navRoute = computed<NavRoute | null>(() => {
  if (!showNavigator.value) return null
  const fromIndex = lastDoneIndex.value
  if (fromIndex == null) return null
  return buildNavRouteFromDoneAt(
    fromIndex,
    cells.length,
    done.value,
    indicesByColor,
  )
})

const compassRoute = computed<NavRoute | null>(() => {
  if (!showCompass.value || !compassFrom.value || !compassTo.value) return null
  return buildRouteBetween(compassFrom.value, compassTo.value)
})

let colorCanvas: HTMLCanvasElement | null = null
let raf = 0
let ro: ResizeObserver | null = null

const pointers = new Map<
  number,
  { x: number; y: number; startX: number; startY: number }
>()
let pinchStartDistance = 0
let pinchStartScale = 1
let panStartX = 0
let panStartY = 0
let panOriginX = 0
let panOriginY = 0
let moved = false
let pinching = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressTriggered = false
let lastTapAt = 0
let lastTapIndex: number | null = null

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

watch(
  () =>
    [
      showBlocks.value,
      showNavigator.value,
      showCompass.value,
      navRoute.value,
      compassRoute.value,
      compassFrom.value,
      done.value,
      activeCode.value,
      activeCodeColor.value,
      gridSize.value,
      gridColor.value,
      cellDividerColor.value,
      navigatorColor.value,
      navigatorSecondaryColor.value,
      compassColor.value,
      compassSecondaryColor.value,
      darkTheme.value,
      softenColorsOnZoom.value,
      veilColor.value,
      doneVeilColor.value,
      washColor.value,
    ] as const,
  () => {
    scheduleDraw()
  },
)

watch(showCompass, () => {
  scheduleDraw()
})

/** Режим прогресса / смена цвета — пересобрать bitmap; done — только если режим вкл. */
watch(
  () => [showProgress.value, progressColor.value] as const,
  () => {
    if (!colorCanvas) return
    colorCanvas = buildColorCanvas()
    scheduleDraw()
  },
)

watch(done, () => {
  if (!showProgress.value || !colorCanvas) return
  colorCanvas = buildColorCanvas()
})

/** Скрытый: крестики/progress-bake не показываем как done; Set не чистим. */
watch(hiddenCodes, () => {
  if (showProgress.value && colorCanvas) {
    colorCanvas = buildColorCanvas()
  }
  scheduleDraw()
})

/**
 * Авто-прогресс только на пересечении порога крестиков (и один раз на маунте).
 * Зум внутри зоны ниже/выше порога не трогает ручной выкл/вкл.
 */
watch(
  () => BASE_CELL * scale.value,
  (cellPx, prevCellPx) => {
    if (!autoProgressOnZoomOut.value) return
    const th = DONE_MARK_MIN_CELL_PX
    if (prevCellPx == null) {
      schemeStore.updateStore({ showProgress: cellPx < th })
      return
    }
    if (prevCellPx >= th && cellPx < th) {
      schemeStore.updateStore({ showProgress: true })
    } else if (prevCellPx < th && cellPx >= th) {
      schemeStore.updateStore({ showProgress: false })
    }
  },
  { immediate: true },
)

watch(autoProgressOnZoomOut, (on) => {
  if (!on) return
  schemeStore.updateStore({
    showProgress: BASE_CELL * scale.value < DONE_MARK_MIN_CELL_PX,
  })
})

function handleCompassTap(cell: { x: number; y: number }) {
  // Уже есть полный путь — начинаем новый замер с этой клетки
  if (compassFrom.value && compassTo.value) {
    schemeStore.updateStore({
      compassFrom: { x: cell.x, y: cell.y },
      compassTo: null,
    })
    return
  }

  if (!compassFrom.value) {
    schemeStore.updateStore({ compassFrom: { x: cell.x, y: cell.y } })
    return
  }

  if (compassFrom.value.x === cell.x && compassFrom.value.y === cell.y) return

  schemeStore.updateStore({ compassTo: { x: cell.x, y: cell.y } })
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  dir: NavSegment['dir'],
) {
  const size = BASE_CELL * 0.32
  const half = size * 0.45
  ctx.beginPath()
  if (dir === 'right') {
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - size, tipY - half)
    ctx.lineTo(tipX - size, tipY + half)
  } else if (dir === 'left') {
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX + size, tipY - half)
    ctx.lineTo(tipX + size, tipY + half)
  } else if (dir === 'down') {
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - half, tipY - size)
    ctx.lineTo(tipX + half, tipY - size)
  } else {
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - half, tipY + size)
    ctx.lineTo(tipX + half, tipY + size)
  }
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = Math.max(1 / scale.value, 0.12)
  ctx.stroke()
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  route: NavRoute,
  color: string,
  labelColor: string,
  labelFill: string,
) {
  if (route.segments.length === 0) return

  const start = cellCenter(route.from.x, route.from.y)
  const mid = cellCenter(route.corner.x, route.corner.y)
  const lastSegment = route.segments[route.segments.length - 1]!
  // Кончик стрелки — в центре клетки назначения
  const tip = cellCenter(route.to.x, route.to.y)
  const arrowSize = BASE_CELL * 0.32

  let lineEndX = tip.x
  let lineEndY = tip.y
  if (lastSegment.dir === 'right') lineEndX -= arrowSize
  else if (lastSegment.dir === 'left') lineEndX += arrowSize
  else if (lastSegment.dir === 'down') lineEndY -= arrowSize
  else lineEndY += arrowSize

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = accentStrokeWidth()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Угол Г-пути рисуем только если это реальный излом (не start и не цель).
  // Иначе при соседней клетке по вертикали corner === to и линия уходит в центр цели.
  const cornerIsBend =
    (route.corner.x !== route.from.x || route.corner.y !== route.from.y) &&
    (route.corner.x !== route.to.x || route.corner.y !== route.to.y)

  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  if (cornerIsBend) {
    ctx.lineTo(mid.x, mid.y)
  }
  ctx.lineTo(lineEndX, lineEndY)
  ctx.stroke()

  const r = BASE_CELL * 0.12
  ctx.beginPath()
  ctx.arc(start.x, start.y, r, 0, Math.PI * 2)
  ctx.fill()

  drawArrowHead(ctx, tip.x, tip.y, lastSegment.dir)

  ctx.font = `600 ${BASE_CELL * 0.5}px Roboto, system-ui, sans-serif`
  ctx.textAlign = 'center'
  // alphabetic + метрики глифа — оптический центр, middle у Roboto часто чуть выше
  ctx.textBaseline = 'alphabetic'
  const rootStyles = getComputedStyle(document.documentElement)
  ctx.letterSpacing =
    rootStyles.getPropertyValue('--tracking-tighter').trim() || '-0.06em'

  for (const segment of route.segments) {
    const a = cellCenter(segment.from.x, segment.from.y)
    const b = cellCenter(segment.to.x, segment.to.y)
    const tx = (a.x + b.x) / 2
    const ty = (a.y + b.y) / 2
    const label = String(segment.count)
    const metrics = ctx.measureText(label)
    const pad = BASE_CELL * 0.15
    const boxH = BASE_CELL * 0.75
    const boxW = Math.max(boxH, metrics.width + pad * 2)
    const radius = BASE_CELL * 0.15
    const boxX = tx - boxW / 2
    const boxY = ty - boxH / 2

    ctx.fillStyle = labelFill
    ctx.strokeStyle = color
    ctx.lineWidth = accentStrokeWidth()
    roundRectPath(ctx, boxX, boxY, boxW, boxH, radius)
    ctx.fill()
    ctx.stroke()

    const ascent = metrics.actualBoundingBoxAscent || BASE_CELL * 0.35
    const descent = metrics.actualBoundingBoxDescent || BASE_CELL * 0.1
    // Положительный сдвиг — ниже в плашке
    const textY = ty + (ascent - descent) / 2 + boxH * 0.075

    ctx.fillStyle = labelColor
    ctx.fillText(label, tx, textY)
  }

  ctx.restore()
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function isActiveCodeCell(x: number, y: number, code: string) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false
  return threadAt(indexAt(x, y)).code === code
}

/**
 * Заливка + общий периметр островов по предикату клетки
 * (рёбра без соседа в множестве; сосед — по схеме, не по viewport).
 */
function drawCellIslandFrames(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  color: string,
  inIsland: (x: number, y: number) => boolean,
) {
  const visible = visibleCellRange(cssW, cssH)
  const borderWidth = accentStrokeWidth()
  let hasCell = false
  let hasEdge = false

  ctx.save()
  ctx.beginPath()
  for (let y = visible.y0; y <= visible.y1; y++) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      if (!inIsland(x, y)) continue
      ctx.rect(x * BASE_CELL, y * BASE_CELL, BASE_CELL, BASE_CELL)
      hasCell = true
    }
  }
  if (hasCell) {
    ctx.fillStyle = frameTintFill(color)
    ctx.fill()
  }

  ctx.strokeStyle = color
  ctx.lineWidth = borderWidth
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  ctx.setLineDash([])
  ctx.beginPath()

  for (let y = visible.y0; y <= visible.y1; y++) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      if (!inIsland(x, y)) continue

      const x0 = x * BASE_CELL
      const y0 = y * BASE_CELL
      const x1 = x0 + BASE_CELL
      const y1 = y0 + BASE_CELL

      if (!inIsland(x, y - 1)) {
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y0)
        hasEdge = true
      }
      if (!inIsland(x, y + 1)) {
        ctx.moveTo(x0, y1)
        ctx.lineTo(x1, y1)
        hasEdge = true
      }
      if (!inIsland(x - 1, y)) {
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0, y1)
        hasEdge = true
      }
      if (!inIsland(x + 1, y)) {
        ctx.moveTo(x1, y0)
        ctx.lineTo(x1, y1)
        hasEdge = true
      }
    }
  }

  if (hasEdge) ctx.stroke()
  ctx.restore()
}

/** ActiveCode: акцент + периметр островов. */
function drawActiveCodeHighlight(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
) {
  const code = activeCode.value
  if (!code) return
  drawCellIslandFrames(ctx, cssW, cssH, activeCodeColor.value, (x, y) =>
    isActiveCodeCell(x, y, code),
  )
}

function collectCellFrames(): CellFrame[] {
  const frames: CellFrame[] = []

  if (showNavigator.value && navRoute.value) {
    frames.push({
      x: navRoute.value.from.x,
      y: navRoute.value.from.y,
      color: navigatorColor.value,
      dashed: true,
    })
    frames.push({
      x: navRoute.value.to.x,
      y: navRoute.value.to.y,
      color: navigatorColor.value,
      dashed: false,
    })
  }

  if (showCompass.value) {
    if (compassFrom.value && !compassTo.value) {
      frames.push({
        x: compassFrom.value.x,
        y: compassFrom.value.y,
        color: compassColor.value,
        dashed: true,
      })
    }
    if (compassRoute.value) {
      frames.push({
        x: compassRoute.value.from.x,
        y: compassRoute.value.from.y,
        color: compassColor.value,
        dashed: true,
      })
      frames.push({
        x: compassRoute.value.to.x,
        y: compassRoute.value.to.y,
        color: compassColor.value,
        dashed: false,
      })
    }
  }

  return frames
}

function drawCellFrames(ctx: CanvasRenderingContext2D, frames: CellFrame[]) {
  if (frames.length === 0) return

  const borderWidth = accentStrokeWidth()
  // Пунктир от размера клетки — иначе при отдалении stroke ≈ сторона клетки и видно ~2 штриха
  const dash = BASE_CELL * 0.15
  const ringByCell = new Map<string, number>()
  const code = activeCode.value

  // Nav/compass: группы по стилю → один path / один stroke
  type FrameBatch = {
    color: string
    dashed: boolean
    rects: { x: number; y: number; w: number; h: number }[]
  }
  const batches: FrameBatch[] = []
  const batchIndex = new Map<string, number>()
  // Подложка на полную клетку, один раз на (cell, color)
  const tintByColor = new Map<string, { x: number; y: number }[]>()
  const tintedKeys = new Set<string>()

  for (const frame of frames) {
    const key = `${frame.x},${frame.y}`
    const tintKey = `${key}\0${frame.color}`
    if (!tintedKeys.has(tintKey)) {
      tintedKeys.add(tintKey)
      let tintCells = tintByColor.get(frame.color)
      if (!tintCells) {
        tintCells = []
        tintByColor.set(frame.color, tintCells)
      }
      tintCells.push({ x: frame.x, y: frame.y })
    }

    // ring 0 занят периметром activeCode на этой клетке
    const baseRing =
      code && isActiveCodeCell(frame.x, frame.y, code) ? 1 : 0
    const ring = ringByCell.get(key) ?? baseRing
    ringByCell.set(key, ring + 1)

    const cellX = frame.x * BASE_CELL
    const cellY = frame.y * BASE_CELL
    // ring 0 — внешний край совпадает с квадратом клетки; дальше — обхватывающие кольца
    const inset = borderWidth / 2 - ring * borderWidth
    const styleKey = `${frame.color}\0${frame.dashed ? 1 : 0}\0${ring}`

    let batch = batches[batchIndex.get(styleKey) ?? -1]
    if (!batch) {
      batch = { color: frame.color, dashed: frame.dashed, rects: [] }
      batchIndex.set(styleKey, batches.length)
      batches.push(batch)
    }
    batch.rects.push({
      x: cellX + inset,
      y: cellY + inset,
      w: BASE_CELL - inset * 2,
      h: BASE_CELL - inset * 2,
    })
  }

  for (const [color, cells] of tintByColor) {
    ctx.save()
    ctx.fillStyle = frameTintFill(color)
    ctx.beginPath()
    for (const cell of cells) {
      ctx.rect(cell.x * BASE_CELL, cell.y * BASE_CELL, BASE_CELL, BASE_CELL)
    }
    ctx.fill()
    ctx.restore()
  }

  for (const batch of batches) {
    ctx.save()
    ctx.strokeStyle = batch.color
    ctx.lineWidth = borderWidth
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'
    ctx.setLineDash(batch.dashed ? [dash, dash] : [])
    ctx.beginPath()
    for (const r of batch.rects) {
      ctx.rect(r.x, r.y, r.w, r.h)
    }
    ctx.stroke()
    ctx.restore()
  }
}

function drawDoneMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cx = x * BASE_CELL
  const cy = y * BASE_CELL
  ctx.fillStyle = tinycolor(doneVeilColor.value).toRgbString()
  ctx.fillRect(cx, cy, BASE_CELL, BASE_CELL)

  // Белый крест ~75% диагонали по центру; толщина как у навигатора/компаса
  const pad = BASE_CELL * ((1 - 0.75) / 2)
  const x0 = cx + pad
  const y0 = cy + pad
  const x1 = cx + BASE_CELL - pad
  const y1 = cy + BASE_CELL - pad
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = accentStrokeWidth()
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.moveTo(x1, y0)
  ctx.lineTo(x0, y1)
  ctx.stroke()
  ctx.restore()
}

function indexAt(x: number, y: number) {
  return indexAtXY(x, y, width)
}

function softWashFill(): string | null {
  return softWashFillAt({
    enabled: softenColorsOnZoom.value,
    washColor: washColor.value,
    scale: scale.value,
    maxScale: getMaxScale(),
  })
}

/** Кэш ink по палитре для текущего wash. */
let inkTableWashKey: string | null | undefined = undefined
let inkTable: string[] = []

function getInkTable(wash: string | null): string[] {
  if (wash === inkTableWashKey && inkTable.length === palette.length) {
    return inkTable
  }
  inkTableWashKey = wash
  inkTable = buildInkTable(palette, wash)
  return inkTable
}

function drawCellSymbol(
  ctx: CanvasRenderingContext2D,
  cell: SchemePaletteEntry,
  x: number,
  y: number,
  ink: string,
) {
  const cx = x * BASE_CELL + BASE_CELL / 2
  const cy = y * BASE_CELL + BASE_CELL / 2
  ctx.fillStyle = ink

  if (cell.icon) {
    const glyph = iconGlyphs[cell.icon]
    if (!glyph) return
    ctx.font = `${glyph.weight} ${BASE_CELL * 0.55}px "Font Awesome 5 Free"`
    ctx.fillText(glyph.char, cx, cy)
    return
  }

  if (!cell.symbol || cell.symbol === '(пусто)') return
  ctx.font = `${BASE_CELL * 0.55}px Roboto, system-ui, sans-serif`
  ctx.fillText(cell.symbol, cx, cy)
}

function buildColorCanvas() {
  return buildColorCanvasBitmap({
    width,
    height,
    cells,
    palette,
    done: done.value,
    hiddenCodes: hiddenCodes.value,
    showProgress: showProgress.value,
    progressColor: progressColor.value,
  })
}

function getViewSize() {
  const root = rootRef.value
  if (!root) return null
  const viewW = root.clientWidth
  const viewH = root.clientHeight
  if (!viewW || !viewH) return null
  return { viewW, viewH }
}

function getFitScale(viewW: number, viewH: number) {
  return getFitScaleAt(viewW, viewH, width, height)
}

function clampScale(next: number) {
  const view = getViewSize()
  if (!view) return next
  return clampScaleAt(next, view.viewW, view.viewH, width, height)
}

function clampPan() {
  const view = getViewSize()
  if (!view) return

  const contentW = width * BASE_CELL * scale.value
  const contentH = height * BASE_CELL * scale.value
  panX.value = clampAxis(panX.value, contentW, view.viewW)
  panY.value = clampAxis(panY.value, contentH, view.viewH)
}

function clearOrientHideTimer() {
  if (orientHideTimer) {
    clearTimeout(orientHideTimer)
    orientHideTimer = null
  }
}

/** Полоски ориентации: доля видимого окна и позиция pan (стиль как UiScrollY ghost). */
function syncOrientBars() {
  const view = getViewSize()
  const railV = orientRailVRef.value
  const railH = orientRailHRef.value
  if (!view) return

  const contentW = width * BASE_CELL * scale.value
  const contentH = height * BASE_CELL * scale.value
  const centerX = view.viewW / 2
  const centerY = view.viewH / 2

  if (railV && contentH > 1) {
    const track = railV.clientHeight
    const ratio = Math.min(1, view.viewH / contentH)
    const thumbH = Math.max(ratio * track, ORIENT_MIN_THUMB_PX)
    const maxTop = Math.max(0, track - thumbH)
    const progress = (centerY - panY.value) / contentH
    orientV.value = {
      show: ratio < 0.999,
      top: Math.min(maxTop, Math.max(0, progress * maxTop)),
      height: Math.min(track, thumbH),
    }
  } else {
    orientV.value = { show: false, top: 0, height: 0 }
  }

  if (railH && contentW > 1) {
    const track = railH.clientWidth
    const ratio = Math.min(1, view.viewW / contentW)
    const thumbW = Math.max(ratio * track, ORIENT_MIN_THUMB_PX)
    const maxLeft = Math.max(0, track - thumbW)
    const progress = (centerX - panX.value) / contentW
    orientH.value = {
      show: ratio < 0.999,
      left: Math.min(maxLeft, Math.max(0, progress * maxLeft)),
      width: Math.min(track, thumbW),
    }
  } else {
    orientH.value = { show: false, left: 0, width: 0 }
  }
}

function flashOrientBars() {
  syncOrientBars()
  if (!orientV.value.show && !orientH.value.show) {
    orientActive.value = false
    return
  }
  orientActive.value = true
  clearOrientHideTimer()
  orientHideTimer = setTimeout(() => {
    orientActive.value = false
    orientHideTimer = null
  }, ORIENT_HIDE_MS)
}

function fitToView() {
  const view = getViewSize()
  if (!view) return

  const fit = getFitScale(view.viewW, view.viewH)
  scale.value = clampScale(fit * 0.98)
  panX.value = (view.viewW - width * BASE_CELL * scale.value) / 2
  panY.value = (view.viewH - height * BASE_CELL * scale.value) / 2
  clampPan()
  scheduleDraw()
}

function scheduleDraw() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}

watch([panX, panY, scale], () => {
  flashOrientBars()
})

let canvasCssW = 0
let canvasCssH = 0
let canvasDpr = 0

function draw() {
  const canvas = canvasRef.value
  const root = rootRef.value
  if (!canvas || !root || !colorCanvas) return

  const dpr = window.devicePixelRatio || 1
  const cssW = root.clientWidth
  const cssH = root.clientHeight
  const bufW = Math.max(1, Math.floor(cssW * dpr))
  const bufH = Math.max(1, Math.floor(cssH * dpr))

  // Ресайз буфера только при реальном изменении — иначе каждый кадр сбрасывает GPU-текстуру
  if (
    cssW !== canvasCssW ||
    cssH !== canvasCssH ||
    dpr !== canvasDpr ||
    canvas.width !== bufW ||
    canvas.height !== bufH
  ) {
    canvas.width = bufW
    canvas.height = bufH
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvasCssW = cssW
    canvasCssH = cssH
    canvasDpr = dpr
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  // Фон как у `.scheme-viewer` (токен `--color-surface-hover`)
  const viewBg = getComputedStyle(root).backgroundColor
  ctx.fillStyle =
    viewBg && viewBg !== 'rgba(0, 0, 0, 0)' && viewBg !== 'transparent'
      ? viewBg
      : getComputedStyle(document.documentElement)
          .getPropertyValue('--color-surface-hover')
          .trim() ||
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-bg')
          .trim()
  ctx.fillRect(0, 0, cssW, cssH)

  ctx.save()
  ctx.translate(panX.value, panY.value)
  ctx.scale(scale.value, scale.value)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(colorCanvas, 0, 0, width * BASE_CELL, height * BASE_CELL)

  const wash = softWashFill()
  if (wash) {
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, width * BASE_CELL, height * BASE_CELL)
  }

  const cellPx = BASE_CELL * scale.value
  // Та же LOD, что у символов/иконок — мелкая разлиновка только когда клетки крупные
  const showGrid = cellPx >= 24
  const showMarks = cellPx >= DONE_MARK_MIN_CELL_PX

  if (showGrid) {
    const visible = visibleCellRange(cssW, cssH)
    // Линии по границам видимых клеток (+ правый/нижний край диапазона), не через всю схему
    const gx0 = visible.x0
    const gy0 = visible.y0
    const gx1 = visible.x1 + 1
    const gy1 = visible.y1 + 1
    const xMin = gx0 * BASE_CELL
    const yMin = gy0 * BASE_CELL
    const xMax = gx1 * BASE_CELL
    const yMax = gy1 * BASE_CELL

    ctx.strokeStyle = cellDividerColor.value
    ctx.lineWidth = 1 / scale.value
    ctx.beginPath()
    for (let x = gx0; x <= gx1; x++) {
      const px = x * BASE_CELL
      ctx.moveTo(px, yMin)
      ctx.lineTo(px, yMax)
    }
    for (let y = gy0; y <= gy1; y++) {
      const py = y * BASE_CELL
      ctx.moveTo(xMin, py)
      ctx.lineTo(xMax, py)
    }
    ctx.stroke()
  }

  if (showBlocks.value) {
    const block = gridSize.value
    ctx.strokeStyle = gridColor.value
    ctx.lineWidth = Math.max(2 / scale.value, 0.2)
    ctx.beginPath()
    for (let x = 0; x <= width; x += block) {
      ctx.moveTo(x * BASE_CELL, 0)
      ctx.lineTo(x * BASE_CELL, height * BASE_CELL)
    }
    for (let y = 0; y <= height; y += block) {
      ctx.moveTo(0, y * BASE_CELL)
      ctx.lineTo(width * BASE_CELL, y * BASE_CELL)
    }
    // Правый и нижний край схемы, если размер не кратен блоку
    if (width % block !== 0) {
      ctx.moveTo(width * BASE_CELL, 0)
      ctx.lineTo(width * BASE_CELL, height * BASE_CELL)
    }
    if (height % block !== 0) {
      ctx.moveTo(0, height * BASE_CELL)
      ctx.lineTo(width * BASE_CELL, height * BASE_CELL)
    }
    ctx.stroke()
  }

  if (cellPx >= 24) {
    const visible = visibleCellRange(cssW, cssH)
    const inks = getInkTable(wash)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let y = visible.y0; y <= visible.y1; y++) {
      for (let x = visible.x0; x <= visible.x1; x++) {
        const index = indexAt(x, y)
        const paletteIndex = cells[index]!
        drawCellSymbol(ctx, palette[paletteIndex]!, x, y, inks[paletteIndex]!)
      }
    }
  }

  // После символа: затемнение + крест; скрытый код / прогресс / ниже LOD — не рисуем.
  if (!showProgress.value && showMarks && done.value.size) {
    const visible = visibleCellRange(cssW, cssH)
    const hidden = hiddenCodes.value
    for (let y = visible.y0; y <= visible.y1; y++) {
      for (let x = visible.x0; x <= visible.x1; x++) {
        const index = indexAt(x, y)
        if (!done.value.has(index)) continue
        if (hidden.has(threadAt(index).code)) continue
        drawDoneMark(ctx, x, y)
      }
    }
  }

  // Focus-veil поверх схемы (клетки под ним не вырезаем / не перерисовываем)
  const showFocusVeil =
    (showNavigator.value && !!navRoute.value) ||
    (showCompass.value && !!(compassFrom.value || compassTo.value))
  if (showFocusVeil) {
    ctx.restore()
    ctx.fillStyle = tinycolor(veilColor.value).toRgbString()
    ctx.fillRect(0, 0, cssW, cssH)
    ctx.save()
    ctx.translate(panX.value, panY.value)
    ctx.scale(scale.value, scale.value)
  }

  // Рамки и маршруты — поверх veil
  drawActiveCodeHighlight(ctx, cssW, cssH)
  drawCellFrames(ctx, collectCellFrames())

  // Линия, стрелка и цифры — тоже поверх
  if (showNavigator.value && navRoute.value) {
    drawRoute(
      ctx,
      navRoute.value,
      navigatorColor.value,
      navigatorColor.value,
      navigatorSecondaryColor.value,
    )
  }
  if (showCompass.value && compassRoute.value) {
    drawRoute(
      ctx,
      compassRoute.value,
      compassColor.value,
      compassColor.value,
      compassSecondaryColor.value,
    )
  }

  ctx.restore()
}

function visibleCellRange(cssW: number, cssH: number) {
  return visibleCellRangeAt(
    cssW,
    cssH,
    panX.value,
    panY.value,
    scale.value,
    width,
    height,
  )
}

function clientToCell(clientX: number, clientY: number) {
  const root = rootRef.value
  if (!root) return null
  return clientToCellAt(
    clientX,
    clientY,
    root.getBoundingClientRect(),
    panX.value,
    panY.value,
    scale.value,
    width,
    height,
  )
}

/** «Готово» только когда крестики на LOD видны. */
function canMarkDone() {
  return BASE_CELL * scale.value >= DONE_MARK_MIN_CELL_PX
}

function toggleCell(index: number) {
  if (!canMarkDone()) return
  if (hiddenCodes.value.has(threadAt(index).code)) return
  schemeStore.toggleCell(index)
}

function pointerDistance() {
  const pts = [...pointers.values()]
  if (pts.length < 2) return 0
  const dx = pts[0].x - pts[1].x
  const dy = pts[0].y - pts[1].y
  return Math.hypot(dx, dy)
}

function pointerMidpoint() {
  const pts = [...pointers.values()]
  return {
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  }
}

function zoomAt(clientX: number, clientY: number, nextScale: number) {
  const root = rootRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const clamped = clampScale(nextScale)

  const worldX = (localX - panX.value) / scale.value
  const worldY = (localY - panY.value) / scale.value
  scale.value = clamped
  panX.value = localX - worldX * scale.value
  panY.value = localY - worldY * scale.value
  clampPan()
  scheduleDraw()
}

function onPointerDown(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
  })
  moved = false
  pinching = pointers.size >= 2
  longPressTriggered = false
  clearLongPress()

  if (pointers.size === 1) {
    panStartX = event.clientX
    panStartY = event.clientY
    panOriginX = panX.value
    panOriginY = panY.value

    const startCell = clientToCell(event.clientX, event.clientY)
    if (startCell) {
      longPressTimer = setTimeout(() => {
        longPressTimer = null
        if (moved || pinching || pointers.size !== 1) return
        if (cells[startCell.index] == null) return
        longPressTriggered = true
        schemeStore.toggleActiveCode(threadAt(startCell.index).code)
      }, LONG_PRESS_MS)
    }
  }

  if (pointers.size === 2) {
    clearLongPress()
    pinchStartDistance = pointerDistance()
    pinchStartScale = scale.value
    pinching = true
  }
}

function onPointerMove(event: PointerEvent) {
  const point = pointers.get(event.pointerId)
  if (!point) return
  point.x = event.clientX
  point.y = event.clientY

  if (pointers.size === 2) {
    clearLongPress()
    pinching = true
    moved = true
    const distance = pointerDistance()
    if (!pinchStartDistance) return
    const mid = pointerMidpoint()
    zoomAt(mid.x, mid.y, pinchStartScale * (distance / pinchStartDistance))
    return
  }

  if (pointers.size === 1) {
    const dx = event.clientX - panStartX
    const dy = event.clientY - panStartY
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) {
      moved = true
      clearLongPress()
    }
    if (!moved) return
    panX.value = panOriginX + dx
    panY.value = panOriginY + dy
    clampPan()
    scheduleDraw()
  }
}

function onPointerUp(event: PointerEvent) {
  const point = pointers.get(event.pointerId)
  pointers.delete(event.pointerId)
  clearLongPress()

  if (pointers.size < 2) {
    pinchStartDistance = 0
  }

  if (pointers.size === 1) {
    const remaining = [...pointers.values()][0]
    panStartX = remaining.x
    panStartY = remaining.y
    panOriginX = panX.value
    panOriginY = panY.value
    return
  }

  if (
    pointers.size === 0 &&
    point &&
    !moved &&
    !pinching &&
    !longPressTriggered
  ) {
    const cell = clientToCell(point.startX, point.startY)
    if (cell) {
      if (showCompass.value) {
        handleCompassTap(cell)
        lastTapIndex = null
        lastTapAt = 0
      } else {
        const now = performance.now()
        if (
          lastTapIndex === cell.index &&
          now - lastTapAt <= DBL_TAP_MS
        ) {
          toggleCell(cell.index)
          lastTapIndex = null
          lastTapAt = 0
        } else {
          lastTapIndex = cell.index
          lastTapAt = now
        }
      }
    }
  }

  if (pointers.size === 0) {
    pinching = false
    longPressTriggered = false
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const factor = event.deltaY > 0 ? 0.9 : 1.1
  zoomAt(event.clientX, event.clientY, scale.value * factor)
}

onMounted(async () => {
  colorCanvas = buildColorCanvas()
  fitToView()
  ro = new ResizeObserver(() => {
    scale.value = clampScale(scale.value)
    clampPan()
    scheduleDraw()
  })
  if (rootRef.value) ro.observe(rootRef.value)

  try {
    await Promise.all([
      document.fonts.load('400 16px "Font Awesome 5 Free"'),
      document.fonts.load('900 16px "Font Awesome 5 Free"'),
      document.fonts.load('400 16px Roboto'),
      document.fonts.load('600 16px Roboto'),
    ])
  } catch {
    // Если шрифт не загрузился — схема всё равно рисуется.
  }
  scheduleDraw()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  clearLongPress()
  clearOrientHideTimer()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div
    ref="rootRef"
    class="scheme-viewer"
    :class="{ 'scheme-viewer--orient-active': orientActive }"
  >
    <canvas
      ref="canvasRef"
      class="scheme-viewer__canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    />

    <div
      ref="orientRailVRef"
      class="scheme-viewer__orient scheme-viewer__orient--v"
      :class="{ 'scheme-viewer__orient--off': !orientV.show }"
      aria-hidden="true"
    >
      <div
        class="scheme-viewer__orient-thumb"
        :style="{
          height: `${orientV.height}px`,
          transform: `translateY(${orientV.top}px)`,
        }"
      />
    </div>
    <div
      ref="orientRailHRef"
      class="scheme-viewer__orient scheme-viewer__orient--h"
      :class="{ 'scheme-viewer__orient--off': !orientH.show }"
      aria-hidden="true"
    >
      <div
        class="scheme-viewer__orient-thumb"
        :style="{
          width: `${orientH.width}px`,
          transform: `translateX(${orientH.left}px)`,
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.scheme-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  border-radius: inherit;
  background: var(--color-surface-hover);
}

.scheme-viewer__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
}

.scheme-viewer__canvas:active {
  cursor: grabbing;
}

/* Ghost-полоски ориентации — как UiScrollY thumb */
.scheme-viewer__orient {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

.scheme-viewer__orient--off {
  visibility: hidden;
}

.scheme-viewer__orient--v {
  top: var(--border-width);
  right: var(--border-width);
  bottom: calc(var(--border-width) + var(--scrollbar-size) + var(--border-width));
  width: var(--scrollbar-size);
}

.scheme-viewer__orient--h {
  left: var(--border-width);
  right: calc(var(--border-width) + var(--scrollbar-size) + var(--border-width));
  bottom: var(--border-width);
  height: var(--scrollbar-size);
}

.scheme-viewer__orient-thumb {
  border-radius: var(--radius-full);
  background: var(--color-border);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.scheme-viewer__orient--v .scheme-viewer__orient-thumb {
  width: 100%;
}

.scheme-viewer__orient--h .scheme-viewer__orient-thumb {
  height: 100%;
}

.scheme-viewer--orient-active .scheme-viewer__orient-thumb {
  opacity: var(--opacity-ghost);
}
</style>
