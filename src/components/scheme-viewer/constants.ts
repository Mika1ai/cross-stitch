export const BASE_CELL = 8
/**
 * Толщина акцентных штрихов (рамки active/nav/compass, крестики, линии маршрута)
 * в coords схемы: ≈ ACCENT_STROKE_CSS_PX на экране, не тоньше ACCENT_STROKE_MIN.
 */
export const ACCENT_STROKE_CSS_PX = 1.5
export const ACCENT_STROKE_MIN = 0.35
/** Крестики «готово» (и жест mark) только при cellPx >= этом. Ниже — ничего. */
export const DONE_MARK_MIN_CELL_PX = 12
/** При макс. зуме одна клетка схемы занимает столько CSS-пикселей */
export const MAX_CELL_PX = 100
/**
 * При мин. зуме вдоль «упорной» оси карточки влезает столько схем.
 * Упорная ось = min(cardW/schemeW, cardH/schemeH).
 */
export const MIN_SCHEMES_IN_VIEW = 1.25
export const TAP_MOVE_PX = 8
/** Двойной тап для «готово» (одинарный — только компас / long-press). */
export const DBL_TAP_MS = 350
export const LONG_PRESS_MS = 1000
/** Как у UiScrollY: сколько держать ghost-thumb после pan/zoom */
export const ORIENT_HIDE_MS = 750
export const ORIENT_MIN_THUMB_PX = 28
export const FRAME_TINT_ALPHA = 0.25
