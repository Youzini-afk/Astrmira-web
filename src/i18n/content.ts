import { baseContent } from './base-content';
import { uiChinese } from './ui';
import { aboutCopy } from '../data/about';
import type { Locale, InternationalLocale } from '../i18n';

const dictionaries = import.meta.glob('./messages/*.json', { eager: true, import: 'default' });
type Widen<T> = T extends string ? string : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;
export type SiteContent = Widen<typeof baseContent>;
const cache = new Map<InternationalLocale, SiteContent>();
// These are identities or external resources, not display prose.
function isMetadata(path: string, key: string) {
  return (/\.projectDetails\.[^.]+$/.test(path) && ['name', 'kind', 'repository', 'license'].includes(key))
    || (/\.about\.projects\.\d+$/.test(path) && ['name', 'path'].includes(key))
    || (/\.about\.names\.\d+$/.test(path) && key === 'term');
}
function localize(base: unknown, translated: any, path: string): any {
  if (typeof base === 'string') {
    if (typeof translated !== 'string' || !translated.trim()) throw new Error(`Missing translation: ${path}`);
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[0]).sort().join(',');
    if (placeholders(base) !== placeholders(translated)) throw new Error(`Mismatched translation placeholders: ${path}`);
    return translated;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(translated) || translated.length !== base.length) throw new Error(`Incomplete translation: ${path}`);
    return base.map((value, index) => localize(value, translated[index], `${path}.${index}`));
  }
  if (base && typeof base === 'object') return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, isMetadata(path, key) ? value : localize(value, translated?.[key], `${path}.${key}`)]));
  return base;
}
export function getContent(locale: InternationalLocale): SiteContent {
  if (locale === 'en') return baseContent;
  if (!cache.has(locale)) cache.set(locale, localize(baseContent, dictionaries[`./messages/${locale}.json`], locale));
  return cache.get(locale)!;
}
export const getUi = (locale: Locale) => locale === 'zh-cn' ? uiChinese : getContent(locale).ui;
export const getAbout = (locale: Locale) => locale === 'zh-cn' ? aboutCopy['zh-cn'] : getContent(locale).about;
