<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { listSchemesWithProgress } from '../lib/schemes-api'
import { schemePreviewUrl } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

type GalleryItem = Awaited<ReturnType<typeof listSchemesWithProgress>>[number]

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { user } = storeToRefs(auth)

const items = ref<GalleryItem[]>([])
const loading = ref(true)
const error = ref('')
const openingId = ref<string | null>(null)

watchEffect(() => {
  document.title = `${t('gallery.title')} · ${t('app.title')}`
})

async function load() {
  const userId = user.value?.id
  if (!userId) return
  loading.value = true
  error.value = ''
  try {
    items.value = await listSchemesWithProgress(userId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('gallery.loadError')
  } finally {
    loading.value = false
  }
}

async function openScheme(schemeId: string) {
  openingId.value = schemeId
  await router.push({ name: 'scheme', params: { schemeId } })
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="gallery-page">
    <header class="gallery-page__header">
      <h1 class="gallery-page__title">{{ t('gallery.title') }}</h1>
      <div class="gallery-page__actions">
        <SchemeSettings scope="general" />
      </div>
    </header>

    <p v-if="loading" class="ui-status">{{ t('common.loading') }}</p>
    <p v-else-if="error" class="ui-error" role="alert">{{ error }}</p>
    <p v-else-if="items.length === 0" class="ui-status">
      {{ t('gallery.empty') }}
    </p>

    <ul v-else class="gallery-grid">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="gallery-card"
          :disabled="openingId === item.id"
          :aria-label="t('gallery.open', { title: item.title })"
          @click="openScheme(item.id)"
        >
          <div class="gallery-card__preview">
            <img
              v-if="schemePreviewUrl(item.preview_path)"
              :src="schemePreviewUrl(item.preview_path)!"
              :alt="item.title"
              class="gallery-card__image"
              loading="lazy"
            />
            <div v-else class="gallery-card__placeholder" />
          </div>
          <div class="gallery-card__meta">
            <span class="gallery-card__name">{{ item.title }}</span>
            <span class="gallery-card__progress">{{
              t('gallery.progress', { percent: item.percent })
            }}</span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gallery-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100svh;
  padding: var(--space-4);
  background: var(--color-bg);
}

.gallery-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.gallery-page__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text);
}

.gallery-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.gallery-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .gallery-card:hover {
    border-color: var(--color-text-muted);
  }
}

.gallery-card:disabled {
  opacity: var(--opacity-disabled);
  cursor: wait;
}

.gallery-card__preview {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-surface-hover);
}

.gallery-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.gallery-card__placeholder {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      135deg,
      var(--color-surface-hover),
      var(--color-border)
    );
}

.gallery-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
}

.gallery-card__name {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.gallery-card__progress {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
