<script setup lang="ts">
import { onBeforeUnmount, useId, watch } from 'vue'
import { acquireModalOpen, releaseModalOpen } from '../../lib/modal-open'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  /** Primary action label */
  confirmLabel: string
  /** Optional secondary action (e.g. discard / use server) */
  secondaryLabel?: string
  cancelLabel: string
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  secondary: []
  cancel: []
}>()

const titleId = useId()

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (isOpen) acquireModalOpen()
    else if (wasOpen === true) releaseModalOpen()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (props.open) releaseModalOpen()
  document.body.style.overflow = ''
})

function onCancel() {
  if (props.busy) return
  emit('update:open', false)
  emit('cancel')
}

function onConfirm() {
  if (props.busy) return
  emit('confirm')
}

function onSecondary() {
  if (props.busy) return
  emit('secondary')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div class="confirm__backdrop" @click="onCancel" />
      <div class="confirm__panel">
        <h2 :id="titleId" class="confirm__title">{{ title }}</h2>
        <p class="confirm__message">{{ message }}</p>
        <div class="confirm__actions">
          <UiButton
            class="ui-btn-block"
            :disabled="busy"
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </UiButton>
          <UiButton
            v-if="secondaryLabel"
            class="ui-btn-block"
            :disabled="busy"
            @click="onSecondary"
          >
            {{ secondaryLabel }}
          </UiButton>
          <UiButton
            class="ui-btn-block"
            :disabled="busy"
            @click="onCancel"
          >
            {{ cancelLabel }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.confirm__backdrop {
  position: absolute;
  inset: 0;
  background: var(--color-overlay);
}

.confirm__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 24rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.confirm__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--color-text);
}

.confirm__message {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  white-space: pre-line;
}

.confirm__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>
