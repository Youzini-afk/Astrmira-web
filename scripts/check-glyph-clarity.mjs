import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serveMotionBuild } from './motion-browser-server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.argv.find(a => a.startsWith('--screenshots='))?.slice(14);
if (output) await mkdir(output, { recursive: true });
const server = await serveMotionBuild();
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];

// Compare actual framebuffer stroke edges with the original native glyph
// raster. A low-resolution output enlarged by CSS cannot pass this check.
async function compareInk(worker) {
  return worker.evaluate(() => {
    const gl = self.__testGlyphGL;
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const output = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, output);
    const reference = new OffscreenCanvas(width, height);
    const ctx = reference.getContext('2d', { willReadFrequently: true });
    for (const { source, rect: [left, top] } of self.__glyphSources.values()) ctx.drawImage(source, left, top);
    const expected = ctx.getImageData(0, 0, width, height).data;
    let count = 0, edges = 0, error = 0, edgeError = 0, maxError = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = expected[(y * width + x) * 4 + 3];
      const actual = output[((height - 1 - y) * width + x) * 4 + 3];
      if (!alpha && !actual) continue;
      const delta = Math.abs(alpha - actual);
      count++; error += delta; maxError = Math.max(maxError, delta);
      if (alpha > 0 && alpha < 255) { edges++; edgeError += delta; }
    }
    return { pixels: count, edges, meanError: error / count, edgeError: edgeError / edges, maxError };
  });
}

try {
  for (const [dpr, locale] of [[1.25, 'zh-CN'], [2, 'zh-CN'], [3, 'zh-CN'], [3, 'en']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale });
    await page.goto(new URL(locale === 'en' ? '/en/' : '/', server.url).href);
    await page.waitForFunction(() => document.documentElement.dataset.particleRenderer === 'scene-worker');
    await page.waitForFunction(() => document.querySelector('.hero-copy').classList.contains('is-solidified'));
    const worker = page.workers().find(w => w.url().includes('particle-worker'));
    await page.waitForTimeout(1200);
    const box = await page.locator('.hero-glyph-surface').boundingBox();
    const size = await worker.evaluate(() => ({ width: self.__testGlyphGL.drawingBufferWidth, height: self.__testGlyphGL.drawingBufferHeight, skyWidth: self.__testGL.drawingBufferWidth }));
    assert.ok(Math.abs(size.width - box.width * dpr) < 1 && Math.abs(size.height - box.height * dpr) < 1, 'Glyph output must use the native pixel density.');
    assert.ok(size.skyWidth <= 390 * 1.5 + 1, 'The sky keeps its cheaper independent raster.');
    const ink = await compareInk(worker);
    assert.ok(ink.edges > 500 && ink.pixels > 2000, 'Measure real, antialiased text strokes.');
    assert.ok(ink.meanError < .8 && ink.edgeError < 1.2 && ink.maxError < 8, `Native glyph pixels must survive rendering: ${JSON.stringify(ink)}`);
    const before = await worker.evaluate(() => ({ sky: self.__motionEvidence.draws, glyphs: self.__motionEvidence.glyphDraws }));
    await page.waitForTimeout(600);
    const after = await worker.evaluate(() => ({ sky: self.__motionEvidence.draws, glyphs: self.__motionEvidence.glyphDraws }));
    assert.equal(after.glyphs, before.glyphs, 'Settled lettering must not repaint with the stars.');
    assert.ok(after.sky > before.sky, 'Background motion continues independently.');
    if (output) await page.screenshot({ path: path.join(output, `${locale}-${dpr}x.png`) });
    if (dpr === 3 && locale === 'zh-CN') {
      await worker.evaluate(() => {
        const gl = self.__testGL, wait = gl.clientWaitSync.bind(gl); let calls = 0;
        gl.clientWaitSync = (...args) => ++calls % 3 ? gl.TIMEOUT_EXPIRED : wait(...args);
      });
      await page.waitForTimeout(2700);
      const reducedSky = await worker.evaluate(() => self.__testGL.drawingBufferWidth);
      assert.ok(reducedSky < 390 * 1.5, 'Exercise the background pressure response.');
      assert.equal(await worker.evaluate(() => self.__testGlyphGL.drawingBufferWidth), size.width, 'Background pressure must never downsample lettering.');
      const retained = await compareInk(worker);
      assert.ok(retained.edgeError < 1.2, 'Text remains sharp when the background scales down.');
    }
    results.push({ dpr, locale, output: size, ink });
    await page.close();
  }
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally { await browser.close(); await server.close(); }
