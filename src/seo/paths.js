import { localePath } from '../i18n/routing.js';

export function canonicalPath(pathname, locale) {
  const unprefixed = localePath(pathname, 'zh-cn');
  return localePath(unprefixed === '/contact/' ? '/collaborate/' : unprefixed, locale);
}

export function markdownPath(pathname) {
  return pathname === '/' ? '/index.md' : pathname.replace(/\/$/, '/index.md');
}
