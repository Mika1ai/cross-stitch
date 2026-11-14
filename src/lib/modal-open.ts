import { computed, readonly, ref } from 'vue'

const openCount = ref(0)

/** Учесть открытие модалки / диалога (UiModal, ConfirmDialog, …). */
export function acquireModalOpen() {
  openCount.value += 1
}

/** Учесть закрытие; счётчик не уходит ниже нуля. */
export function releaseModalOpen() {
  openCount.value = Math.max(0, openCount.value - 1)
}

export const openModalCount = readonly(openCount)

export const hasOpenModal = computed(() => openCount.value > 0)
