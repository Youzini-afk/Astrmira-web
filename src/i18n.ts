export type Locale = 'zh-cn' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh-cn';
export const SUPPORTED_LOCALES: Locale[] = ['zh-cn', 'en'];

export function localePath(pathname: string, locale: Locale) {
  const [pathWithQuery, hash = ''] = pathname.split('#');
  const [rawPath, query = ''] = pathWithQuery.split('?');
  let path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  path = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  const localized = locale === 'en' ? `/en${path === '/' ? '/' : path}` : path;
  return localized + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

export const localeName: Record<Locale, string> = {
  'zh-cn': '简体中文',
  en: 'English'
};

