<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconsLoading from '../../assets/icons/loading.svg?component'

withDefaults(
  defineProps<{
    /** CSS size of the spinner */
    size?: string
    /** Accessible name; default — common.loading */
    label?: string
  }>(),
  {
    size: '4rem',
    label: undefined,
  },
)

const { t } = useI18n()
</script>

<template>
  <div
    class="loading"
    role="status"
    :aria-label="label ?? t('common.loading')"
    :style="{ '--loading-size': size }"
  >
    <IconsLoading class="loading__icon" />
  </div>
</template>

<style scoped>
.loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #884bfd;
  overflow: visible;
}

.loading__icon {
  display: block;
  width: var(--loading-size);
  height: var(--loading-size);
  overflow: visible;
  --arm-len: 29.7;
  /* Один проход keyframe: слева → холд → вправо. Второй крестик — тот же со сдвигом ½ цикла. */
  --cycle: 2s;
  --fly: 112.5%;
}

.loading__icon :deep(.loading-arm) {
  stroke-dasharray: var(--arm-len);
  stroke-dashoffset: var(--arm-len);
}

.loading__icon :deep(.loading-cross) {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
}

.loading__icon :deep(.loading-cross--1 .loading-arm--a) {
  animation: loading-arm-a var(--cycle) linear infinite;
}
.loading__icon :deep(.loading-cross--1 .loading-arm--b) {
  animation: loading-arm-b var(--cycle) linear infinite;
}
.loading__icon :deep(.loading-cross--1) {
  animation:
    loading-cross-move var(--cycle) linear infinite,
    loading-cross-fade var(--cycle) linear infinite;
}

.loading__icon :deep(.loading-cross--2 .loading-arm--a) {
  animation: loading-arm-a var(--cycle) linear infinite;
  animation-delay: calc(var(--cycle) * -0.5);
}
.loading__icon :deep(.loading-cross--2 .loading-arm--b) {
  animation: loading-arm-b var(--cycle) linear infinite;
  animation-delay: calc(var(--cycle) * -0.5);
}
.loading__icon :deep(.loading-cross--2) {
  animation:
    loading-cross-move var(--cycle) linear infinite,
    loading-cross-fade var(--cycle) linear infinite;
  animation-delay: calc(var(--cycle) * -0.5);
}

/*
  Один цикл:
  0–45%   приезд слева + opacity 0→1 + отрисовка
  45–55%  холд
  55–100% уезд вправо + opacity 1→0

  translate — linear; opacity — ease-in-out / linear / ease-in-out.
*/

@keyframes loading-arm-a {
  0% {
    stroke-dashoffset: var(--arm-len);
    animation-timing-function: ease-in-out;
  }
  22.5% {
    stroke-dashoffset: 0;
    animation-timing-function: linear;
  }
  99.99% {
    stroke-dashoffset: 0;
    animation-timing-function: linear;
  }
  100% {
    stroke-dashoffset: var(--arm-len);
  }
}

@keyframes loading-arm-b {
  0% {
    stroke-dashoffset: var(--arm-len);
    animation-timing-function: linear;
  }
  22.5% {
    stroke-dashoffset: var(--arm-len);
    animation-timing-function: ease-in-out;
  }
  45% {
    stroke-dashoffset: 0;
    animation-timing-function: linear;
  }
  99.99% {
    stroke-dashoffset: 0;
    animation-timing-function: linear;
  }
  100% {
    stroke-dashoffset: var(--arm-len);
  }
}

@keyframes loading-cross-move {
  0% {
    transform: translate(calc(-1 * var(--fly)), 0);
  }
  45%,
  55% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(var(--fly), 0);
  }
}

@keyframes loading-cross-fade {
  0% {
    opacity: 0;
    animation-timing-function: ease-in-out;
  }
  45% {
    opacity: 1;
    animation-timing-function: linear;
  }
  55% {
    opacity: 1;
    animation-timing-function: ease-in-out;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading__icon :deep(.loading-arm) {
    stroke-dashoffset: 0;
    animation: none;
  }

  .loading__icon :deep(.loading-cross--1) {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .loading__icon :deep(.loading-cross--2) {
    animation: none;
    opacity: 0;
  }
}
</style>
