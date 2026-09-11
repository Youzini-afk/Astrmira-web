import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve('dist');
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + decodeURIComponent(pathname) + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
    response.end(body);
  } catch (_) { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const englishRoutes = [
  '/en/', '/en/about/', '/en/collaborate/', '/en/contact/', '/en/projects/',
  '/en/projects/data-systems/', '/en/projects/agent-platform/', '/en/projects/piarium/', '/en/projects/research-partnerships/',
  '/en/research/', '/en/research/databases/', '/en/research/retrieval/', '/en/research/vectors/',
  '/en/research/quantization/', '/en/research/post-training/', '/en/research/mathematics/',
  '/en/research/papers/low-bit-decisions/', '/en/research/papers/contextual-quantization/',
  '/en/research/papers/covariance-binary-quantization/', '/en/research/papers/quiver/'
];

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const request = await browser.newContext().then(context => context.request);
  for (const route of englishRoutes) {
    const response = await request.get(origin + route);
    assert.equal(response.status(), 200, route);
    const html = await response.text();
    assert.match(html, /<html lang="en"/, route);
    assert.match(html, /hreflang="zh-CN"/, route);
    assert.match(html, /hreflang="en"/, route);
  }

  const zhContext = await browser.newContext({ locale: 'zh-CN' });
  const zh = await zhContext.newPage();
  await zh.goto(origin + '/');
  assert.equal(new URL(zh.url()).pathname, '/');
  assert.equal(await zh.locator('html').getAttribute('lang'), 'zh-CN');
  assert.equal(await zh.locator('[data-locale-choice="en"]').getAttribute('href'), '/en/');
  assert.equal(await zh.locator('[data-locale-choice="zh-cn"]').getAttribute('aria-current'), 'true');
  await zh.locator('.language-trigger').click();
  assert.ok(await zh.locator('[data-locale-choice="en"]').isVisible());
  await zh.keyboard.press('Escape');
  assert.equal(await zh.locator('[data-language-picker]').evaluate(n => n.open), false);
  assert.ok(await zh.locator('.language-trigger').evaluate(n => n === document.activeElement));
  await zh.locator('.language-trigger').click();
  await zh.locator('main').click({ position: { x: 10, y: 10 } });
  assert.equal(await zh.locator('[data-language-picker]').evaluate(n => n.open), false);
  await zh.locator('.language-trigger').click();
  await zh.locator('[data-locale-choice="en"]').click();
  await zh.waitForURL('**/en/');
  await zh.goto(origin + '/');
  await zh.waitForURL('**/en/');
  assert.equal(new URL(zh.url()).pathname, '/en/', 'a manual English choice must override Chinese browser detection');
  await zhContext.close();

  const enContext = await browser.newContext({ locale: 'en-US' });
  const en = await enContext.newPage();
  await en.goto(origin + '/');
  await en.waitForURL('**/en/');
  assert.equal(await en.locator('html').getAttribute('lang'), 'en');
  assert.deepEqual(await en.locator('.site-nav [data-route]').allTextContents(), ['Projects', 'Research', 'About', 'Work with us ↗']);
  assert.ok((await en.locator('.site-nav [data-route]').evaluateAll(links => links.every(link => new URL(link.href).pathname.startsWith('/en/')))));
  await en.locator('.language-trigger').click();
  await en.locator('[data-locale-choice="zh-cn"]').click();
  await en.waitForURL(origin + '/');
  await en.reload();
  assert.equal(new URL(en.url()).pathname, '/', 'a manual Chinese choice must override English browser detection');
  await en.goto(origin + '/en/research/papers/quiver/');
  assert.equal(await en.locator('[data-locale-choice="zh-cn"]').getAttribute('href'), '/research/papers/quiver/');

  await en.goto(origin + '/en/collaborate/');
  await en.locator('#contact-problem').fill('Explore a shared retrieval research question.');
  await en.locator('[data-brief-form]').evaluate(form => form.requestSubmit());
  assert.match(await en.locator('[data-brief-text]').textContent(), /Collaboration brief/);
  assert.match(await en.locator('[data-brief-status]').textContent(), /has not been sent/);
  await enContext.close();

  const fallbackContext = await browser.newContext({ locale: 'ja-JP' });
  const fallback = await fallbackContext.newPage();
  await fallback.goto(origin + '/');
  await fallback.waitForURL('**/en/');
  assert.equal(new URL(fallback.url()).pathname, '/en/', 'unsupported browser languages should use the international English version');
  await fallbackContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  await mobile.goto(origin + '/projects/data-systems/');
  await mobile.locator('[data-menu-toggle]').tap();
  await mobile.locator('.language-trigger').tap();
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'true', 'Escape dismisses the language picker before the mobile navigation');
  await mobile.locator('.language-trigger').tap();
  await mobile.locator('[data-locale-choice="en"]').tap();
  await mobile.waitForURL('**/en/projects/data-systems/');
  await mobileContext.close();

  const nativeContext = await browser.newContext({ javaScriptEnabled: false, locale: 'zh-CN', reducedMotion: 'reduce' });
  const native = await nativeContext.newPage();
  await native.goto(origin + '/about/');
  await native.locator('.language-trigger').click();
  await native.locator('[data-locale-choice="en"]').click();
  await native.waitForURL('**/en/about/');
  await nativeContext.close();
  console.log(`PASS: ${englishRoutes.length} English routes, language dropdown, mobile and native navigation, locale persistence, alternate links, and localized collaboration brief.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
