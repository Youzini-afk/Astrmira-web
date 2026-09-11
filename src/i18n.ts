import { LOCALES } from './i18n/routing.js';
export type Locale = 'zh-cn' | 'zh-hant' | 'en' | 'ja' | 'ko' | 'fr' | 'de';
export type InternationalLocale = Exclude<Locale, 'zh-cn'>;
export { LOCALES, DEFAULT_LOCALE, SUPPORTED_LOCALES, localePath } from './i18n/routing.js';
export const localeName = Object.fromEntries(LOCALES.map(locale => [locale.id, locale.name])) as Record<Locale, string>;
