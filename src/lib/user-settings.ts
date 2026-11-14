import { DEFAULT_LOCALE, isAppLocale } from '../i18n'
import { supabase } from './supabase'
import type { UserSettingsPrefs } from '../types/database'

export const USER_SETTINGS_DEFAULTS: UserSettingsPrefs = {
  locale: DEFAULT_LOCALE,
  darkTheme: true,
  markDoneOnSingleTap: false,
}

export function mergeUserSettingsPrefs(raw: unknown): UserSettingsPrefs {
  const base = { ...USER_SETTINGS_DEFAULTS }
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<UserSettingsPrefs>
  return {
    locale:
      typeof input.locale === 'string' && isAppLocale(input.locale)
        ? input.locale
        : base.locale,
    darkTheme:
      typeof input.darkTheme === 'boolean' ? input.darkTheme : base.darkTheme,
    markDoneOnSingleTap:
      typeof input.markDoneOnSingleTap === 'boolean'
        ? input.markDoneOnSingleTap
        : base.markDoneOnSingleTap,
  }
}

export async function fetchUserSettings(userId: string): Promise<{
  prefs: UserSettingsPrefs
  exists: boolean
}> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return {
    prefs: mergeUserSettingsPrefs(data?.prefs),
    exists: Boolean(data),
  }
}

export async function saveUserSettings(
  userId: string,
  prefs: UserSettingsPrefs,
): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      prefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
