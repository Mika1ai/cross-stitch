import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { i18n, type AppLocale } from '../i18n'
import {
  fetchUserSettings,
  saveUserSettings,
  USER_SETTINGS_DEFAULTS,
} from '../lib/user-settings'
import type { UserSettingsPrefs } from '../types/database'

export type UserSettingsPatch = Partial<UserSettingsPrefs>

export const useUserSettingsStore = defineStore('userSettings', () => {
  const locale = ref<AppLocale>(USER_SETTINGS_DEFAULTS.locale)
  const darkTheme = ref(USER_SETTINGS_DEFAULTS.darkTheme)
  const markDoneOnSingleTap = ref(USER_SETTINGS_DEFAULTS.markDoneOnSingleTap)
  const loadedUserId = ref<string | null>(null)
  const loading = ref(false)

  let persistSeq = 0

  function applyPrefs(prefs: UserSettingsPrefs) {
    locale.value = prefs.locale
    darkTheme.value = prefs.darkTheme
    markDoneOnSingleTap.value = prefs.markDoneOnSingleTap
  }

  function resetToDefaults() {
    loadedUserId.value = null
    applyPrefs(USER_SETTINGS_DEFAULTS)
  }

  function currentPrefs(): UserSettingsPrefs {
    return {
      locale: locale.value,
      darkTheme: darkTheme.value,
      markDoneOnSingleTap: markDoneOnSingleTap.value,
    }
  }

  async function loadForUser(userId: string) {
    loading.value = true
    try {
      const { prefs, exists } = await fetchUserSettings(userId)
      applyPrefs(prefs)
      loadedUserId.value = userId
      if (!exists) await saveUserSettings(userId, prefs)
    } catch (e) {
      console.error('[userSettings] failed to load', e)
      applyPrefs(USER_SETTINGS_DEFAULTS)
      loadedUserId.value = userId
    } finally {
      loading.value = false
    }
  }

  async function patch(next: UserSettingsPatch) {
    if (next.locale !== undefined) locale.value = next.locale
    if (next.darkTheme !== undefined) darkTheme.value = next.darkTheme
    if (next.markDoneOnSingleTap !== undefined) {
      markDoneOnSingleTap.value = next.markDoneOnSingleTap
    }

    const userId = loadedUserId.value
    if (!userId) return

    const seq = ++persistSeq
    const prefs = currentPrefs()
    try {
      await saveUserSettings(userId, prefs)
    } catch (e) {
      if (seq !== persistSeq) return
      console.error('[userSettings] failed to save', e)
    }
  }

  watch(
    darkTheme,
    (on) => {
      document.documentElement.dataset.theme = on ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', on ? '#161514' : '#f7f6f4')
    },
    { immediate: true },
  )

  watch(
    locale,
    (code) => {
      i18n.global.locale.value = code
      document.documentElement.lang = code
    },
    { immediate: true },
  )

  return {
    locale,
    darkTheme,
    markDoneOnSingleTap,
    loadedUserId,
    loading,
    loadForUser,
    resetToDefaults,
    patch,
    currentPrefs,
  }
})
