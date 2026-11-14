<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const { ready } = storeToRefs(auth)

/** Пока идёт page transition — обрезаем viewport, чтобы не мигал scrollbar. */
const pageTransitioning = ref(false)

function onPageTransitionStart() {
  pageTransitioning.value = true
  document.documentElement.style.overflow = 'hidden'
}

function onPageTransitionEnd() {
  pageTransitioning.value = false
  document.documentElement.style.overflow = ''
}
</script>

<template>
  <div
    class="app-root"
    :data-page-transition="pageTransitioning ? '' : undefined"
  >
    <div v-if="!ready" class="app-boot" aria-busy="true">
      <UiLoading />
    </div>
    <RouterView v-else v-slot="{ Component, route }">
      <Transition
        name="page"
        mode="out-in"
        @before-enter="onPageTransitionStart"
        @before-leave="onPageTransitionStart"
        @after-enter="onPageTransitionEnd"
      >
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100svh;
}

.app-root[data-page-transition] {
  height: 100svh;
  overflow: hidden;
}

.app-boot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
  background: var(--color-bg);
}
</style>

<style>
.page-enter-active,
.page-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(var(--space-2));
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
