import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serveMotionBuild, installMainProbe } from './motion-browser-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.argv.find(a => a.startsWith('--screenshots='))?.slice(14);
if (output) await mkdir(output, { recursive: true });
const server = await serveMotionBuild();
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [];
const watch = p => p.on('pageerror', e => errors.push(e.message));
const ready = p => p.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'scene-worker');
const settled = p => p.waitForFunction(() => document.querySelector('.hero-copy')?.classList.contains('is-solidified'));
const nativeText = p => p.evaluate(() => {
  const style = getComputedStyle(document.querySelector('.hero-subtitle'));
  return style.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' && style.visibility !== 'hidden';
});
const ink = async (worker, page, rect) => {
  const bounds = await page.locator('.hero-glyph-surface').boundingBox();
  return worker.evaluate(({ rect, bounds }) => {
    const gl = self.__testGlyphGL, ratio = gl.drawingBufferWidth / bounds.width;
    const x = Math.max(0, Math.floor((rect.x - bounds.x) * ratio));
    const right = Math.min(gl.drawingBufferWidth, Math.ceil((rect.x + rect.width - bounds.x) * ratio));
    const top = Math.max(0, Math.floor((rect.y - bounds.y) * ratio));
    const bottom = Math.min(gl.drawingBufferHeight, Math.ceil((rect.y + rect.height - bounds.y) * ratio));
    const pixels = new Uint8Array((right - x) * (bottom - top) * 4);
    gl.readPixels(x, gl.drawingBufferHeight - bottom, right - x, bottom - top, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
    return sum;
  }, { rect, bounds });
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25, locale: 'zh-CN' });
  watch(page); await page.addInitScript(installMainProbe);
  await page.goto(server.url); await ready(page);
  assert.equal(await page.locator('canvas').count(), 2, 'one adaptive sky and one native-resolution text surface');
  if (output) { await page.waitForTimeout(2400); await page.screenshot({ path: path.join(output, 'opening.png') }); }
  await settled(page); await page.waitForTimeout(400);
  const worker = page.workers().find(w => w.url().includes('particle-worker'));
  const box = await page.locator('.hero h1').boundingBox(), rect = { ...box, viewportWidth: 1440 };
  const original = await ink(worker, page, rect);
  assert.ok(original > 1000000, 'the GPU must actually paint the full heading');
  for (let i = 0; i <= 12; i++) { await page.mouse.move(box.x + box.width * (.2 + i * .045), box.y + box.height * .5); await page.waitForTimeout(24); }
  const disturbed = await ink(worker, page, rect);
  assert.ok(disturbed < original * .99, 'mouse disturbance must remove ink from the glyph');
  await page.mouse.move(5, 5); await page.waitForTimeout(2800);
  assert.ok(await ink(worker, page, rect) > original * .99, 'displaced particles must restore the heading');
  if (output) await page.screenshot({ path: path.join(output, 'settled.png') });

  const before = await worker.evaluate(() => self.__motionEvidence.draws);
  await page.evaluate(() => { const end = performance.now() + 220; while (performance.now() < end) {} });
  const after = await worker.evaluate(() => self.__motionEvidence.draws);
  assert.ok(after - before >= 3, 'the worker must keep animating while the document thread is occupied');
  await page.waitForTimeout(300);
  const main = await page.evaluate(() => ({ ...window.__motionEvidence, callbacks: window.__motionEvidence.callbacks.length }));
  await page.waitForTimeout(300);
  const mainAfter = await page.evaluate(() => window.__motionEvidence.callbacks.length);
  assert.ok(mainAfter - main.callbacks < 5, 'an idle document must not run a perpetual animation loop');
  assert.equal(main.readbacks, 0, 'glyph sampling must not read pixels on the main thread');
  assert.equal(main.particleTransfers, 0, 'the document must not stream particle arrays');

  await worker.evaluate(() => { self.__loss = self.__testGL.getExtension('WEBGL_lose_context'); self.__loss.loseContext(); });
  await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'static');
  assert.ok(await nativeText(page), 'context loss must reveal native text');
  await worker.evaluate(() => self.__loss.restoreContext());
  await ready(page); await settled(page);
  await worker.evaluate(() => { self.__glyphLoss = self.__testGlyphGL.getExtension('WEBGL_lose_context'); self.__glyphLoss.loseContext(); });
  await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'static');
  assert.ok(await nativeText(page), 'glyph context loss also restores readable native text');
  await worker.evaluate(() => self.__glyphLoss.restoreContext());
  await ready(page); await settled(page);
  await page.locator('[data-replay]').click(); await settled(page);

  const destination = await page.locator('.hero').evaluate(el => el.getBoundingClientRect().bottom + scrollY);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(120);
  const intermediate = await page.evaluate(() => scrollY);
  assert.ok(intermediate > 0 && intermediate < destination, 'native hero scroll must have an animated transition');
  if (output) await page.screenshot({ path: path.join(output, 'departure.png') });
  await page.waitForFunction(target => Math.abs(scrollY - target) < 2, destination);
  await page.evaluate(() => { const r = document.querySelector('[data-comet-dock]').getBoundingClientRect(); scrollTo({ top: r.y + r.height / 2 + scrollY - innerHeight * .48, behavior: 'instant' }); });
  await page.waitForFunction(() => document.querySelector('.mira-object').classList.contains('is-docked'));
  assert.ok(await page.evaluate(() => {
    const a = document.querySelector('[data-comet-dock]').getBoundingClientRect(), b = document.querySelector('.mira-object').getBoundingClientRect();
    return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < .2;
  }));
  await page.setViewportSize({ width: 1000, height: 760 }); await page.waitForTimeout(500); await ready(page);
  await page.close();

  for (const fallback of ['no-worker', 'download-failed', 'reduced', 'no-js']) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US', reducedMotion: fallback === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: fallback !== 'no-js' });
    watch(p);
    await p.addInitScript(installMainProbe);
    if (fallback === 'no-worker') await p.addInitScript(() => Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { value: undefined }));
    if (fallback === 'download-failed') await p.route('**/*particle-worker*.js', r => r.abort());
    await p.goto(server.url + 'en/');
    if (fallback === 'reduced') {
      await ready(p); await settled(p);
      assert.ok(await p.evaluate(() => window.__motionEvidence.glyphBounds.every(g => g.left >= -17 && g.left + g.width <= innerWidth + 17)), 'English particle lines must follow mobile text wrapping');
    }
    else assert.ok(await nativeText(p), fallback + ' keeps all text readable');
    assert.ok(await p.locator('.hero-actions a').first().isVisible());
    if (output) await p.screenshot({ path: path.join(output, fallback + '.png') });
    await p.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: GPU ink and disturbance/recovery, independent worker clock, idle main thread, zero particle transfers/readbacks, native hero scroll, docking/resize, context restore, and readable native fallbacks.');
} finally { await browser.close(); await server.close(); }
