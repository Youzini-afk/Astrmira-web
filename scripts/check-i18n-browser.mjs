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
  assert.equal(await zh.locator('.locale-switch').getAttribute('href'), '/en/');
  await zh.locator('.locale-switch').click();
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
  await en.locator('.locale-switch').click();
  await en.waitForURL(origin + '/');
  await en.reload();
  assert.equal(new URL(en.url()).pathname, '/', 'a manual Chinese choice must override English browser detection');
  await en.goto(origin + '/en/research/papers/quiver/');
  assert.equal(await en.locator('.locale-switch').getAttribute('href'), '/research/papers/quiver/');

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
  console.log(`PASS: ${englishRoutes.length} English routes, locale detection, manual override, alternate links, and localized collaboration brief.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
