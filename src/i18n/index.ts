import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

/** Доступные языки UI (nativeName — как показывать в списке). */
export const SUPPORTED_LOCALES = [
  { code: 'ru', nativeName: 'Русский' },
  { code: 'en', nativeName: 'English' },
] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]['code']

export const DEFAULT_LOCALE: AppLocale = 'ru'

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
  },
})

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.some((item) => item.code === value)
}
