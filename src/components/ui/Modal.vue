<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  title: string
}>()

const { t } = useI18n()

const CLOSE_THRESHOLD_PX = 120
/** Согласовано с --duration-normal у `.modal__sheet`. */
const SNAP_MS = 250

const open = ref(false)
const dragY = ref(0)
const isDragging = ref(false)
const isDismissing = ref(false)
const skipLeaveTransition = ref(false)

const startY = ref(0)
const startDragY = ref(0)
const panelRef = ref<HTMLElement | null>(null)
const titleId = useId()

let dismissTimer: ReturnType<typeof setTimeout> | null = null
let previousOverflow = ''
let previousFocus: HTMLElement | null = null

const sheetStyle = computed(() => ({
  transform: `translateY(${dragY.value}px)`,
}))

function clearDismissTimer() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

function resetDrag() {
  dragY.value = 0
  isDragging.value = false
  isDismissing.value = false
  skipLeaveTransition.value = false
}

function openModal() {
  if (open.value) return
  previousFocus = document.activeElement as HTMLElement | null
  open.value = true
}

function closeModal() {
  if (!open.value || isDismissing.value) return
  open.value = false
}

function onHandlePointerDown(event: PointerEvent) {
  if (isDismissing.value) return
  if (event.button !== 0) return

  isDragging.value = true
  startY.value = event.clientY
  startDragY.value = dragY.value
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent) {
  if (!isDragging.value || isDismissing.value) return
  const delta = event.clientY - startY.value
  dragY.value = Math.max(0, startDragY.value + delta)
}

function dismissBySwipe() {
  isDragging.value = false
  isDismissing.value = true
  skipLeaveTransition.value = true
  dragY.value = window.innerHeight

  clearDismissTimer()
  dismissTimer = setTimeout(() => {
    open.value = false
  }, SNAP_MS)
}

function onHandlePointerUp() {
  if (!isDragging.value || isDismissing.value) return
  isDragging.value = false

  if (dragY.value >= CLOSE_THRESHOLD_PX) {
    dismissBySwipe()
    return
  }

  dragY.value = 0
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (!open.value || isDismissing.value) return
  event.preventDefault()
  closeModal()
}

function lockBodyScroll() {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  document.body.style.overflow = previousOverflow
}

watch(open, async (isOpen) => {
  if (isOpen) {
    clearDismissTimer()
    resetDrag()
    lockBodyScroll()
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    panelRef.value?.focus()
    return
  }

  window.removeEventListener('keydown', onKeydown)
  unlockBodyScroll()
  previousFocus?.focus?.()
  previousFocus = null

  clearDismissTimer()
  dismissTimer = setTimeout(() => {
    resetDrag()
  }, SNAP_MS)
})

onBeforeUnmount(() => {
  clearDismissTimer()
  window.removeEventListener('keydown', onKeydown)
  if (open.value) unlockBodyScroll()
})
</script>

<template>
  <div class="modal__trigger" @click="openModal">
    <slot name="trigger" />
  </div>

  <Teleport to="body">
    <Transition name="modal-slide" :css="!skipLeaveTransition">
      <div
        v-if="open"
        ref="panelRef"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <div
          class="modal__sheet"
          :class="{
            'modal__sheet--dragging': isDragging,
            'modal__sheet--dismissing': isDismissing,
          }"
          :style="sheetStyle"
        >
          <div
            class="modal__handle"
            @pointerdown="onHandlePointerDown"
            @pointermove="onHandlePointerMove"
            @pointerup="onHandlePointerUp"
            @pointercancel="onHandlePointerUp"
          >
            <span class="modal__handle-bar" aria-hidden="true" />
            <span class="visually-hidden">{{ t('common.dragToClose') }}</span>
          </div>

          <div class="modal__header">
            <h2 :id="titleId" class="modal__title">{{ title }}</h2>
            <div class="modal__header-actions">
              <slot name="header-actions" />
              <UiButton :aria-label="t('common.close')" @click="closeModal">
                <IconsClose />
              </UiButton>
            </div>
          </div>

          <div class="modal__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.modal__trigger {
  display: contents;
}

.modal {
  position: fixed;
  top: var(--space-2);
  right: var(--space-2);
  bottom: 0;
  left: var(--space-2);
  z-index: 50;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  outline: none;
  overflow: hidden;
}

.modal__sheet {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--space-4);
  padding-top: var(--space-9);
  border: var(--border-width) solid var(--color-border);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: var(--color-surface);
  overflow: hidden;
  will-change: transform;
  transition: transform var(--duration-normal) var(--ease-out);
}

.modal__sheet--dragging {
  transition: none;
}

.modal__handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: var(--space-9);
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.modal__handle:active {
  cursor: grabbing;
}

.modal__handle-bar {
  display: block;
  width: calc(var(--control-height) + var(--space-2));
  height: 0.3rem;
  border-radius: var(--radius-full);
  background: var(--color-border);
}

.modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.modal__title {
  margin: 0;
  min-width: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
}

.modal__header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
}

.modal__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: var(--space-4);
}

.modal .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: transform var(--duration-slow) var(--ease-out);
}

.modal-slide-enter-from,
.modal-slide-leave-to {
  transform: translateY(100%);
}
</style>
