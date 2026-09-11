// @ts-check
import { defineConfig } from 'astro/config';
import { SUPPORTED_LOCALES } from './src/i18n/routing.js';
import discovery from './integrations/discovery.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.astrmira.com',
  integrations: [discovery()],
  i18n: {
    defaultLocale: 'zh-cn',
    locales: SUPPORTED_LOCALES,
    routing: { prefixDefaultLocale: false }
  }
});
