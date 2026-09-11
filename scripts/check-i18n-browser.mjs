import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { serveMotionBuild } from './motion-browser-server.mjs';
import { LOCALES, localePath } from '../src/i18n/routing.js';
import { baseContent } from '../src/i18n/base-content.ts';
import { uiChinese } from '../src/i18n/ui.ts';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serveMotionBuild();
const origin = new URL(server.url).origin;
const paths = ['/', '/about/', '/collaborate/', '/contact/', '/projects/',
  '/projects/data-systems/', '/projects/agent-platform/', '/projects/piarium/', '/projects/research-partnerships/',
  '/research/', '/research/databases/', '/research/retrieval/', '/research/vectors/',
  '/research/quantization/', '/research/post-training/', '/research/mathematics/',
  ...Object.keys(baseContent.papers).map(slug => '/research/papers/' + slug + '/')];
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [];
let routes = 0;
async function context(options = {}) {
  const ctx = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', ...options });
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return ctx;
}
const countLabel = (ui, lang, group, count) =>
  (new Intl.PluralRules(lang).select(count) === 'one' ? ui[group].countOne : ui[group].count).replace('{count}', String(count));

try {
  const requests = await context();
  for (const locale of LOCALES) for (const route of paths) {
    const localized = localePath(route, locale.id);
    const response = await requests.request.get(origin + localized);
    assert.equal(response.status(), 200, localized);
    const html = await response.text();
    assert.ok(html.includes('<html lang="' + locale.lang + '"'), localized);
    assert.ok(html.includes('rel="canonical" href="https://www.astrmira.com' + localized + '"'), localized);
    for (const alt of LOCALES) assert.ok(html.includes('hreflang="' + alt.lang + '" href="https://www.astrmira.com' + localePath(route, alt.id) + '"'), localized);
    assert.ok(html.includes('hreflang="x-default" href="https://www.astrmira.com' + route + '"'), localized);
    for (const match of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>/g)) {
      if (match[0].includes('data-locale-choice') || !match[1].startsWith('/')) continue;
      const href = match[1].split(/[?#]/)[0];
      assert.ok(paths.map(p => localePath(p, locale.id)).includes(href), localized + ' links outside its locale: ' + href);
    }
    assert.ok(!html.includes('[object Object]'), localized);
    routes++;
  }
  await requests.close();

  // Exercise the actual head script, including region/script distinctions
  // and preference ordering when the first browser language is unsupported.
  for (const [languages, expected] of [
    [['zh-CN'], 'zh-cn'], [['zh-TW'], 'zh-hant'], [['zh-HK'], 'zh-hant'],
    [['zh-Hans-TW'], 'zh-cn'], [['ja-JP'], 'ja'], [['ko-KR'], 'ko'],
    [['fr-CA'], 'fr'], [['de-AT'], 'de'], [['en-GB'], 'en'],
    [['es-ES', 'de-DE', 'en-US'], 'de'], [['es-ES', 'it-IT'], 'en']
  ]) {
    const ctx = await context();
    await ctx.addInitScript(values => Object.defineProperty(navigator, 'languages', { get: () => values }), languages);
    const page = await ctx.newPage();
    const suffix = '/about/?from=language-test#about-name';
    await page.goto(origin + suffix);
    await page.waitForURL(origin + localePath(suffix, expected));
    assert.equal(await page.locator('html').getAttribute('data-locale'), expected);
    await ctx.close();
  }

  const choiceContext = await context({ locale: 'en-US' });
  const choice = await choiceContext.newPage();
  const suffix = '/about/?from=menu#about-name';
  await choice.goto(origin + '/en' + suffix);
  for (const locale of LOCALES) {
    await choice.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await choice.locator('.language-trigger').click();
    assert.equal(await choice.locator('[data-locale-choice]').count(), 7);
    await choice.locator('[data-locale-choice="' + locale.id + '"]').click();
    await choice.waitForURL(origin + localePath(suffix, locale.id));
    assert.equal(await choice.evaluate(() => localStorage.getItem('astrmira-locale')), locale.id);
    assert.equal(await choice.locator('[data-locale-choice][aria-current="true"]').getAttribute('data-locale-choice'), locale.id);
    assert.equal(await choice.locator('html').getAttribute('lang'), locale.lang);
    assert.ok(await choice.locator('#about-name').count());
    await choice.goto(origin + suffix);
    await choice.waitForURL(origin + localePath(suffix, locale.id));
  }
  await choice.goto(origin + '/ja/about/');
  assert.equal(await choice.locator('html').getAttribute('lang'), 'ja', 'Explicit language URLs override saved preference.');
  await choice.locator('.language-trigger').click();
  await choice.keyboard.press('Escape');
  assert.equal(await choice.locator('[data-language-picker]').evaluate(n => n.open), false);
  assert.ok(await choice.locator('.language-trigger').evaluate(n => n === document.activeElement));
  await choice.locator('.language-trigger').click();
  await choice.locator('main').click({ position: { x: 10, y: 10 } });
  assert.equal(await choice.locator('[data-language-picker]').evaluate(n => n.open), false);
  await choiceContext.close();

  const blockedStorage = await context({ locale: 'fr-CA' });
  await blockedStorage.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const privatePage = await blockedStorage.newPage();
  await privatePage.goto(origin + '/projects/piarium/');
  await privatePage.waitForURL('**/fr/projects/piarium/');
  await privatePage.locator('.language-trigger').click();
  await privatePage.locator('[data-locale-choice="ko"]').click();
  await privatePage.waitForURL('**/ko/projects/piarium/');
  await blockedStorage.close();

  for (const locale of LOCALES) {
    const copy = locale.id === 'zh-cn' ? { ui: uiChinese } : locale.id === 'en' ? baseContent :
      JSON.parse(await readFile(new URL('../src/i18n/messages/' + locale.id + '.json', import.meta.url), 'utf8'));
    const { ui } = copy, ctx = await context(), page = await ctx.newPage();
    await page.goto(origin + localePath('/collaborate/', locale.id));
    assert.equal(await page.locator('.site-nav [data-route="projects"]').textContent(), ui.nav.projects);
    await page.locator('#contact-name').fill('Zoë 金');
    await page.locator('#contact-area').selectOption({ label: ui.form.areas[1] });
    await page.locator('#contact-problem').fill('A concrete multilingual research question.');
    await page.locator('[data-brief-form]').evaluate(form => form.requestSubmit());
    const brief = await page.locator('[data-brief-text]').textContent();
    assert.ok(brief.includes(ui.form.briefTitle) && brief.includes(ui.form.areas[1]) && brief.includes('Zoë 金'));
    assert.equal(await page.locator('[data-brief-status]').textContent(), ui.form.generated);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-download-brief]').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'Astrmira-' + ui.form.briefTitle + '.txt');
    assert.equal(await readFile(await download.path(), 'utf8'), brief);

    await page.goto(origin + localePath('/research/', locale.id));
    await page.locator('[data-research-search]').fill('2605.02171');
    assert.equal(await page.locator('[data-research-item]:visible').count(), 1);
    assert.equal(await page.locator('[data-research-count]').textContent(), countLabel(ui, locale.lang, 'research', 1));
    if (copy.papers) {
      await page.locator('[data-research-search]').fill(copy.papers['contextual-quantization'].heading);
      assert.equal(await page.locator('[data-research-item]:visible').count(), 1, 'Translated headings are searchable.');
    }
    await page.locator('[data-research-search]').fill('no-paper-matches-this-string');
    assert.ok(await page.locator('[data-empty-search]').isVisible());
    assert.equal(await page.locator('[data-empty-search]').textContent(), ui.research.empty);
    await page.goto(origin + localePath('/projects/', locale.id));
    await page.locator('[data-project-filter="harness"]').click();
    assert.equal(await page.locator('[data-project-directory] .project-card:visible').count(), 1);
    assert.equal(await page.locator('[data-project-count]').textContent(), countLabel(ui, locale.lang, 'projects', 1));
    await page.goto(origin + localePath('/projects/piarium/', locale.id));
    await page.locator('.article-toc').waitFor();
    assert.equal(await page.locator('.article-toc summary').textContent(), ui.toc.title);
    assert.equal(await page.locator('.article-toc a').first().textContent(), ui.toc.overview);
    await ctx.close();
  }

  const mobileContext = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await mobileContext.newPage();
  await mobile.goto(origin + '/projects/data-systems/');
  await mobile.locator('[data-menu-toggle]').tap();
  await mobile.locator('.language-trigger').tap();
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'true');
  await mobile.locator('.language-trigger').tap();
  await mobile.locator('[data-locale-choice="de"]').tap();
  await mobile.waitForURL('**/de/projects/data-systems/');
  await mobileContext.close();

  const nativeContext = await context({ javaScriptEnabled: false });
  const native = await nativeContext.newPage();
  await native.goto(origin + '/about/');
  await native.locator('.language-trigger').click();
  await native.locator('[data-locale-choice="fr"]').click();
  await native.waitForURL('**/fr/about/');
  await nativeContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: ' + routes + ' routes, localized metadata and links, language detection and persistence, seven-language menu, mobile and no-JS navigation, filters, TOCs and collaboration briefs.');
} finally {
  await browser.close();
  await server.close();
}
