// Optional browser regression check against the built site. No test hooks ship.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.argv.find(arg => arg.startsWith('--screenshots='))?.slice(14);
const downloadOnly = process.argv.includes('--worker-download-only');
if (output) await mkdir(output, { recursive: true });
const root = path.resolve('dist');
const workerHook = `const nativeContext = OffscreenCanvas.prototype.getContext;
OffscreenCanvas.prototype.getContext = function(...args) { const context = nativeContext.apply(this, args); if (args[0] === 'webgl') self.__testGL = context; return context; };\n`;
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + decodeURIComponent(pathname) + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    let body = await readFile(file);
    if (path.basename(file).startsWith('particle-worker') && file.endsWith('.js')) body = workerHook + body.toString();
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
    response.end(body);
  } catch (_) { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [];
const watch = page => page.on('pageerror', error => errors.push(error.message));
const settled = async page => {
  await page.waitForFunction(() => document.querySelector('.hero-copy')?.classList.contains('is-solidified'));
  await page.waitForTimeout(300);
};
const glyphs = page => page.evaluate(() => [...document.querySelectorAll('.hero-glyph-surface')].map(canvas => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let alpha = 0;
  for (let i = 3; i < data.length; i += 4) alpha += data[i];
  return alpha;
}));
try {
  if (!downloadOnly) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  watch(page);
  await page.goto(url);
  if (output) { await page.waitForTimeout(2400); await page.screenshot({ path: path.join(output, 'opening.png') }); }
  await settled(page);
  await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'webgl-worker');
  const original = await glyphs(page);
  assert.equal(original.length, 10);
  assert.ok(original.every(alpha => alpha > 0), 'all text and annotation layers must be visible');
  if (output) await page.screenshot({ path: path.join(output, 'settled.png') });
  const box = await page.locator('.hero h1').boundingBox();
  for (let i = 0; i <= 12; i++) {
    await page.mouse.move(box.x + box.width * (.2 + i * .045), box.y + box.height * .5);
    await page.waitForTimeout(24);
  }
  const disturbed = await glyphs(page);
  assert.ok(disturbed.reduce((a, b) => a + b, 0) < original.reduce((a, b) => a + b, 0) * .99, 'pointer must locally dissolve glyphs');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2500);
  const restored = await glyphs(page);
  assert.ok(restored.reduce((a, b) => a + b, 0) > original.reduce((a, b) => a + b, 0) * .99, 'glyphs must settle back');

  const worker = page.workers().find(worker => worker.url().includes('particle-worker'));
  assert.ok(worker);
  await worker.evaluate(() => { self.__testLoss = self.__testGL.getExtension('WEBGL_lose_context'); self.__testLoss.loseContext(); });
  await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'canvas');
  await page.waitForTimeout(100);
  assert.ok((await glyphs(page)).every(alpha => alpha > 0));
  await worker.evaluate(() => self.__testLoss.restoreContext());
  await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'webgl-worker');

  await page.locator('[data-replay]').click();
  await settled(page);
  assert.ok((await glyphs(page)).every(alpha => alpha > 0));
  await page.evaluate(() => { const r = document.querySelector('[data-comet-dock]').getBoundingClientRect(); scrollTo({ top: r.y + r.height / 2 + scrollY - innerHeight * .48, behavior: 'instant' }); });
  await page.waitForFunction(() => document.querySelector('.mira-object').classList.contains('is-docked'));
  assert.ok(await page.evaluate(() => {
    const a = document.querySelector('[data-comet-dock]').getBoundingClientRect(), b = document.querySelector('.mira-object').getBoundingClientRect();
    return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < .1;
  }));
  await page.close();

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  watch(reduced); await reduced.goto(url); await settled(reduced);
  assert.ok((await glyphs(reduced)).every(alpha => alpha > 0), 'reduced motion must never leave blank text');
  await reduced.close();

  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(fallback);
  await fallback.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { value: undefined });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
  });
  await fallback.goto(url); await settled(fallback);
  assert.equal(await fallback.evaluate(() => document.documentElement.dataset.particleRenderer), 'canvas');
  assert.ok((await glyphs(fallback)).every(alpha => alpha > 0), 'Canvas fallback must preserve all lettering');
  if (output) await fallback.screenshot({ path: path.join(output, 'mobile-fallback.png') });
  await fallback.close();
  }

  const blocked = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  watch(blocked);
  let blockedWorkers = 0;
  await blocked.route('**/*particle-worker*.js', route => { blockedWorkers++; return route.abort(); });
  await blocked.goto(url); await settled(blocked);
  assert.ok(blockedWorkers > 0, 'exercise a failed worker download');
  assert.equal(await blocked.evaluate(() => document.documentElement.dataset.particleRenderer), 'canvas');
  assert.ok((await glyphs(blocked)).every(alpha => alpha > 0));
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(downloadOnly ? 'PASS: failed worker download falls back to Canvas with all text visible.' : 'PASS: production worker, 10 glyph layers, pointer disturbance/recovery, context loss/restore, replay, docking, reduced motion, mobile Canvas fallback, failed worker download.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
