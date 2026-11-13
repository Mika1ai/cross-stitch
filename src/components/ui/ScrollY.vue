<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const HIDE_MS = 750
const MIN_THUMB_PX = 28

const viewport = ref<HTMLElement | null>(null)
const rail = ref<HTMLElement | null>(null)
const thumbTop = ref(0)
const thumbHeight = ref(0)
const canScroll = ref(false)
const active = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | null = null
let ro: ResizeObserver | null = null

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function syncThumb() {
  const el = viewport.value
  const trackEl = rail.value
  if (!el || !trackEl) return

  const { scrollTop, scrollHeight, clientHeight } = el
  const overflow = scrollHeight > clientHeight + 1
  canScroll.value = overflow

  if (!overflow) {
    thumbHeight.value = 0
    thumbTop.value = 0
    return
  }

  const track = trackEl.clientHeight
  const height = Math.max((clientHeight / scrollHeight) * track, MIN_THUMB_PX)
  const maxTop = Math.max(0, track - height)
  const progress =
    scrollHeight === clientHeight
      ? 0
      : scrollTop / (scrollHeight - clientHeight)

  thumbHeight.value = height
  thumbTop.value = progress * maxTop
}

function flashThumb() {
  syncThumb()
  if (!canScroll.value) return
  active.value = true
  clearHideTimer()
  hideTimer = setTimeout(() => {
    active.value = false
    hideTimer = null
  }, HIDE_MS)
}

function onScroll() {
  flashThumb()
}

onMounted(() => {
  syncThumb()
  const el = viewport.value
  if (!el || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(() => syncThumb())
  ro.observe(el)
  if (rail.value) ro.observe(rail.value)
  if (el.firstElementChild) ro.observe(el.firstElementChild)
})

onBeforeUnmount(() => {
  clearHideTimer()
  ro?.disconnect()
})
</script>

<template>
  <div
    class="scroll-y"
    :class="{ 'scroll-y--active': active && canScroll }"
  >
    <div
      ref="viewport"
      class="scroll-y__viewport"
      @scroll.passive="onScroll"
    >
      <slot />
    </div>
    <div ref="rail" class="scroll-y__rail" aria-hidden="true">
      <div
        class="scroll-y__thumb"
        :style="{
          height: `${thumbHeight}px`,
          transform: `translateY(${thumbTop}px)`,
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.scroll-y {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.scroll-y__viewport {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
}

.scroll-y__viewport::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.scroll-y__rail {
  position: absolute;
  top: var(--border-width);
  right: var(--border-width);
  bottom: var(--border-width);
  z-index: 2;
  width: var(--scrollbar-size);
  pointer-events: none;
}

.scroll-y__thumb {
  width: 100%;
  border-radius: var(--radius-full);
  background: var(--color-border);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.scroll-y--active .scroll-y__thumb {
  opacity: var(--opacity-ghost);
}
</style>
