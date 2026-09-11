// Also embedded as a classic head script, so first-visit detection runs before
// page paint. Keep this module self-contained: server and browser share it.
export const LOCALES = [
  { id: 'zh-cn', lang: 'zh-CN', name: '简体中文' },
  { id: 'zh-hant', lang: 'zh-Hant', name: '繁體中文' },
  { id: 'en', lang: 'en', name: 'English' },
  { id: 'ja', lang: 'ja', name: '日本語' },
  { id: 'ko', lang: 'ko', name: '한국어' },
  { id: 'fr', lang: 'fr', name: 'Français' },
  { id: 'de', lang: 'de', name: 'Deutsch' },
];
export const DEFAULT_LOCALE = 'zh-cn';
export const SUPPORTED_LOCALES = LOCALES.map(locale => locale.id);

export function matchLocale(language) {
  const parts = String(language || '').toLowerCase().replaceAll('_', '-').split('-');
  if (parts[0] === 'zh') {
    if (parts.includes('hant')) return 'zh-hant';
    if (parts.includes('hans')) return 'zh-cn';
    return parts.some(part => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-hant' : 'zh-cn';
  }
  return SUPPORTED_LOCALES.includes(parts[0]) ? parts[0] : null;
}
export function preferredLocale(languages) {
  for (const language of languages || []) {
    const locale = matchLocale(language);
    if (locale) return locale;
  }
  return 'en';
}
export function localePath(pathname, locale) {
  const hashAt = pathname.indexOf('#');
  const hash = hashAt < 0 ? '' : pathname.slice(hashAt);
  const beforeHash = hashAt < 0 ? pathname : pathname.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt < 0 ? '' : beforeHash.slice(queryAt);
  let path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  if (!path.startsWith('/')) path = '/' + path;
  const prefix = path.split('/')[1];
  if (SUPPORTED_LOCALES.includes(prefix)) path = path.slice(prefix.length + 1) || '/';
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  return (locale === DEFAULT_LOCALE ? path : '/' + locale + path) + query + hash;
}
export function bootstrapLocale() {
  const key = 'astrmira-locale';
  const current = document.documentElement.dataset.locale;
  let saved;
  try { saved = localStorage.getItem(key); } catch (_) {}
  if (current === DEFAULT_LOCALE) {
    const preferred = SUPPORTED_LOCALES.includes(saved) ? saved : preferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (preferred !== current) {
      location.replace(localePath(location.pathname + location.search + location.hash, preferred));
      return;
    }
  }
  document.addEventListener('click', event => {
    const choice = event.target.closest?.('[data-locale-choice]');
    const locale = choice?.dataset.localeChoice;
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    try { localStorage.setItem(key, locale); } catch (_) {}
    choice.href = localePath(location.pathname + location.search + location.hash, locale);
  });
}
