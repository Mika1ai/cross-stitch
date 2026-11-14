<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { SUPPORTED_LOCALES } from '../i18n'
import { NAVIGATOR_ENABLED } from '../lib/feature-flags'
import { formatSyncDiffMessage } from '../lib/sync-diff-message'
import { useAuthStore } from '../stores/auth'
import { useSchemeStore, type SchemeStorePatch } from '../stores/scheme'
import { useUserSettingsStore } from '../stores/userSettings'

const props = withDefaults(
  defineProps<{
    /** `general` — user-global; `all` — плюс настройки схемы */
    scope?: 'all' | 'general'
  }>(),
  { scope: 'all' },
)

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const schemeStore = useSchemeStore()
const userSettings = useUserSettingsStore()
const { user } = storeToRefs(auth)
const { locale, darkTheme, markDoneOnSingleTap } = storeToRefs(userSettings)
const {
  activeCodeColor,
  gridSize,
  gridColor,
  cellDividerColor,
  navigatorColor,
  navigatorSecondaryColor,
  compassColor,
  compassSecondaryColor,
  softenColorsOnZoom,
  veilColor,
  doneVeilColor,
  washColor,
  progressColor,
} = storeToRefs(schemeStore)

const showSchemeSettings = computed(() => props.scope === 'all')
const showSignOut = computed(() => Boolean(user.value))

const signOutOpen = ref(false)
const signOutBusy = ref(false)

const signOutMessage = computed(() => {
  const userId = user.value?.id
  const diffs = userId ? schemeStore.dirtyDiffsForUser(userId) : []
  return formatSyncDiffMessage(t, diffs, 'sync.signOutAsk')
})

function patchStore<K extends keyof SchemeStorePatch>(
  key: K,
  value: SchemeStorePatch[K],
) {
  schemeStore.updateStore({ [key]: value } as Pick<SchemeStorePatch, K>)
}

/** Локальный draft — можно очистить поле; на blur Input с min подставит 1. */
const gridSizeText = ref(String(gridSize.value))

watch(gridSize, (n) => {
  const parsed = Number.parseInt(gridSizeText.value, 10)
  if (parsed === n) return
  gridSizeText.value = String(n)
})

watch(gridSizeText, (value) => {
  const next = Number.parseInt(value, 10)
  if (!Number.isFinite(next)) return
  patchStore('gridSize', Math.max(1, Math.round(next)))
})

function requestSignOut() {
  const userId = user.value?.id
  if (userId && schemeStore.userHasUnsavedProgress(userId)) {
    signOutOpen.value = true
    return
  }
  void doSignOut()
}

async function doSignOut() {
  await auth.signOut()
  await router.replace({ name: 'sign-in' })
}

async function onSignOutSave() {
  const userId = user.value?.id
  if (!userId) return
  signOutBusy.value = true
  try {
    const ok = await schemeStore.flushAllDirtyForUser(userId)
    if (!ok) return
    signOutOpen.value = false
    await doSignOut()
  } finally {
    signOutBusy.value = false
  }
}

async function onSignOutDiscard() {
  const userId = user.value?.id
  if (userId) schemeStore.discardAllDirtyForUser(userId)
  signOutOpen.value = false
  await doSignOut()
}
</script>

<template>
  <UiModal :title="t('settings.title')">
    <template #trigger>
      <UiButton :aria-label="t('settings.open')">
        <IconsSettings />
      </UiButton>
    </template>

    <div class="settings-panel">
      <UiScrollY class="settings-modules">
      <section class="settings-card" aria-labelledby="settings-general">
        <h3 id="settings-general" class="settings-card__title">
          {{ t('settings.general.title') }}
        </h3>
        <div
          v-for="item in SUPPORTED_LOCALES"
          :key="item.code"
          class="settings-row"
        >
          <span class="settings-row__label">{{ item.nativeName }}</span>
          <UiRadio
            :checked="locale === item.code"
            :aria-label="
              t('settings.language.choose', { name: item.nativeName })
            "
            @click="userSettings.patch({ locale: item.code })"
          />
        </div>
        <div class="settings-row">
          <span class="settings-row__label">{{
            t('settings.general.darkTheme')
          }}</span>
          <UiToggle
            :model-value="darkTheme"
            @update:model-value="
              (value) => userSettings.patch({ darkTheme: value })
            "
          />
        </div>
        <div class="settings-row">
          <span class="settings-row__label">{{
            t('settings.general.markDoneOnSingleTap')
          }}</span>
          <UiToggle
            :model-value="markDoneOnSingleTap"
            @update:model-value="
              (value) => userSettings.patch({ markDoneOnSingleTap: value })
            "
          />
        </div>
        <div v-if="showSignOut" class="settings-sign-out">
          <UiButton class="ui-btn-block" @click="requestSignOut">
            {{ t('common.signOut') }}
          </UiButton>
        </div>
      </section>

      <template v-if="showSchemeSettings">
        <section class="settings-card" aria-labelledby="settings-display">
          <h3 id="settings-display" class="settings-card__title">
            {{ t('settings.display.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.display.softenOnZoom')
            }}</span>
            <UiToggle
              :model-value="softenColorsOnZoom"
              @update:model-value="
                (value) => patchStore('softenColorsOnZoom', value)
              "
            />
          </div>
          <div v-if="softenColorsOnZoom" class="settings-row">
            <span class="settings-row__label">{{
              t('settings.display.washColor')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="washColor"
              @update:model-value="
                (value) => patchStore('washColor', value)
              "
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.display.veilColor')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="veilColor"
              @update:model-value="
                (value) => patchStore('veilColor', value)
              "
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.display.doneVeilColor')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="doneVeilColor"
              @update:model-value="
                (value) => patchStore('doneVeilColor', value)
              "
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.display.cellDividerColor')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="cellDividerColor"
              @update:model-value="
                (value) => patchStore('cellDividerColor', value)
              "
            />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="settings-active-cells">
          <h3 id="settings-active-cells" class="settings-card__title">
            {{ t('settings.activeCells.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.activeCells.color')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="activeCodeColor"
              @update:model-value="
                (value) => patchStore('activeCodeColor', value)
              "
            />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="settings-grid">
          <h3 id="settings-grid" class="settings-card__title">
            {{ t('settings.grid.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{ t('settings.grid.size') }}</span>
            <UiInput
              v-model="gridSizeText"
              inputmode="numeric"
              align="center"
              auto-grow
              max-width="5rem"
              :pattern="/^[0-9]*$/"
              :min="1"
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{ t('settings.grid.color') }}</span>
            <UiColorPicker
              alpha
              :model-value="gridColor"
              @update:model-value="
                (value) => patchStore('gridColor', value)
              "
            />
          </div>
        </section>

        <section
          v-if="NAVIGATOR_ENABLED"
          class="settings-card"
          aria-labelledby="settings-navigator"
        >
          <h3 id="settings-navigator" class="settings-card__title">
            {{ t('settings.navigator.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.navigator.color')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="navigatorColor"
              @update:model-value="
                (value) => patchStore('navigatorColor', value)
              "
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.navigator.secondaryColor')
            }}</span>
            <UiColorPicker
              :model-value="navigatorSecondaryColor"
              @update:model-value="
                (value) =>
                  patchStore('navigatorSecondaryColor', value)
              "
            />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="settings-compass">
          <h3 id="settings-compass" class="settings-card__title">
            {{ t('settings.compass.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.compass.color')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="compassColor"
              @update:model-value="
                (value) => patchStore('compassColor', value)
              "
            />
          </div>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.compass.secondaryColor')
            }}</span>
            <UiColorPicker
              :model-value="compassSecondaryColor"
              @update:model-value="
                (value) =>
                  patchStore('compassSecondaryColor', value)
              "
            />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="settings-progress">
          <h3 id="settings-progress" class="settings-card__title">
            {{ t('settings.progress.title') }}
          </h3>
          <div class="settings-row">
            <span class="settings-row__label">{{
              t('settings.progress.color')
            }}</span>
            <UiColorPicker
              alpha
              :model-value="progressColor"
              @update:model-value="
                (value) => patchStore('progressColor', value)
              "
            />
          </div>
        </section>

        <div class="settings-reset">
          <UiButton
            class="ui-btn-block"
            @click="schemeStore.resetSchemeSettings()"
          >
            {{ t('settings.reset') }}
          </UiButton>
        </div>
      </template>
      </UiScrollY>
    </div>
  </UiModal>

  <UiConfirmDialog
    v-model:open="signOutOpen"
    :title="t('sync.signOutTitle')"
    :message="signOutMessage"
    :confirm-label="t('sync.signOutSave')"
    :secondary-label="t('sync.signOutDiscard')"
    :cancel-label="t('sync.signOutCancel')"
    :busy="signOutBusy"
    @confirm="onSignOutSave"
    @secondary="onSignOutDiscard"
  />
</template>

<style scoped>
.settings-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.settings-modules {
  flex: 1 1 auto;
}

.settings-panel :deep(.scroll-y__viewport) {
  border-radius: inherit;
}

.settings-modules :deep(.scroll-y__viewport) {
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-block: var(--space-4);
}

.settings-card:first-child {
  padding-top: 0;
}

.settings-card:last-child {
  padding-bottom: 0;
}

.settings-card + .settings-card {
  border-top: var(--border-width) solid var(--color-border);
}

.settings-card__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--color-text);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.settings-row__label {
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.settings-sign-out {
  margin-top: var(--space-2);
}

.settings-reset {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
