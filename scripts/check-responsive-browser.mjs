import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serveMotionBuild } from './motion-browser-server.mjs';
import { localePath } from '../src/i18n/routing.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const audit = process.argv.includes('--audit');
const screenshotDir = process.argv.find(arg => arg.startsWith('--screenshots='))?.slice(14);
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const server = await serveMotionBuild();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const sizeArgument = process.argv.find(arg => arg.startsWith('--sizes='))?.slice(8);
const sizes = sizeArgument ? sizeArgument.split(',').map(size => size.split('x').map(Number)) : [[320, 568], [390, 844], [600, 960], [768, 1024], [820, 1180], [1024, 768], [844, 390], [1440, 900]];
const locales = process.argv.find(arg => arg.startsWith('--locales='))?.slice(10).split(',') || ['zh-cn', 'en'];
const routes = ['/', '/projects/', '/research/', '/projects/data-systems/', '/research/papers/low-bit-decisions/', '/about/', '/collaborate/'];
const failures = [];
let checked = 0;

function layoutEvidence() {
  const width = document.documentElement.clientWidth;
  const clipped = node => {
    for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) return true;
    }
    return false;
  };
  const outside = [...document.querySelectorAll('.site-header *, main *, footer *')].filter(node => {
    if (node.closest('svg') || clipped(node) || !node.getClientRects().length) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > width + 1);
  }).map(node => ({ element: node.tagName + '.' + node.className, text: node.textContent.trim().slice(0, 60), width: Math.round(node.getBoundingClientRect().width) }));
  const textOverflow = [...document.querySelectorAll('h1,h2,h3,p,.text-link,.button')].filter(node => {
    if (!node.getClientRects().length || node.closest('svg')) return false;
    const r = node.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some(line => line.width && (line.left < r.left - 4 || line.right > r.right + 4));
  }).map(node => node.textContent.trim().slice(0, 70));
  return { outside, textOverflow, heroHeight: document.querySelector('.hero')?.offsetHeight, menu: getComputedStyle(document.querySelector('[data-menu-toggle]')).display };
}

async function swipe(session, from, to) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12, id: 1 }] });
    await new Promise(resolve => setTimeout(resolve, 32));
  }
  // Release without a fling so the assertion can distinguish touch scrolling
  // from the desktop wheel gesture that jumps beyond the entire hero.
  await new Promise(resolve => setTimeout(resolve, 120));
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function checkInteractions() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en' });
  await context.addInitScript(() => {
    window.__responsiveProbe = { layouts: 0, state: null, glyphs: [], scrollCalls: 0 };
    const post = Worker.prototype.postMessage, scroll = window.scrollTo;
    Worker.prototype.postMessage = function(message, ...args) {
      if (message.type === 'layout') {
        window.__responsiveProbe.layouts++;
        window.__responsiveProbe.glyphs = message.layout.glyphs.map(g => ({ left: g.left, right: g.left + g.bitmap.width / g.dpr }));
      }
      if (message.state) window.__responsiveProbe.state = message.state;
      return post.call(this, message, ...args);
    };
    window.scrollTo = (...args) => { window.__responsiveProbe.scrollCalls++; return scroll(...args); };
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/en/', server.url).href);
  await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
  await page.locator('[data-replay]').tap();
  await page.waitForFunction(() => window.__responsiveProbe.state?.introEpoch > 0);
  const scrollCalls = await page.evaluate(() => window.__responsiveProbe.scrollCalls);
  await swipe(session, { x: 185, y: 610 }, { x: 185, y: 350 });
  await page.waitForFunction(() => scrollY > 80 && !window.__responsiveProbe.state.introEpoch);
  assert.equal(await page.evaluate(() => window.__responsiveProbe.scrollCalls), scrollCalls, 'Touch navigation must keep native scrolling.');
  assert.ok(await page.evaluate(() => scrollY < document.querySelector('.hero').offsetHeight), 'A short swipe must not skip the entire hero.');
  assert.ok(await page.locator('.hero-copy').evaluate(n => n.classList.contains('is-settled')), 'Early scrolling must release the opening animation.');

  const track = page.locator('[data-paper-track]');
  await track.evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const beforeY = await page.evaluate(() => scrollY);
  const trackBox = await track.boundingBox();
  await swipe(session, { x: 320, y: trackBox.y + 140 }, { x: 75, y: trackBox.y + 140 });
  await page.waitForFunction(() => document.querySelector('[data-paper-track]').scrollLeft > 100);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - beforeY) < 3, 'A sideways paper swipe must not move the document.');
  await page.locator('[data-paper-next]').tap();

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const toggle = page.locator('[data-menu-toggle]'), nav = page.locator('#site-nav');
  await toggle.tap();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await nav.isVisible());
  await page.touchscreen.tap(10, 600);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'An outside tap dismisses the menu.');
  await toggle.tap();
  await page.keyboard.press('Escape');
  assert.ok(await toggle.evaluate(n => n === document.activeElement));
  await toggle.tap();
  await page.setViewportSize({ width: 1024, height: 768 });
  assert.ok(await nav.isVisible(), 'Tablet landscape keeps the full navigation.');
  await page.setViewportSize({ width: 844, height: 390 });
  await toggle.tap();
  const navBox = await nav.boundingBox();
  assert.ok(navBox.y + navBox.height <= 391, 'Landscape navigation must scroll within the available height.');
  await nav.locator('.nav-contact').tap();
  await page.waitForURL('**/en/collaborate/');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('[name=problem]').fill('A mobile collaboration brief that stays readable and fully operable.');
  assert.equal(await page.locator('[name=problem]').evaluate(n => getComputedStyle(n).fontSize), '16px');
  const fields = await page.locator('.form-grid .field').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
  assert.ok(fields[1] > fields[0], 'Phone form fields must stack.');
  await page.locator('button[type=submit]').tap();
  assert.ok(await page.locator('[data-brief-result]').isVisible());
  const briefLayout = await page.evaluate(layoutEvidence);
  assert.deepEqual(briefLayout.outside, []);
  assert.deepEqual(briefLayout.textOverflow, []);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(new URL('/en/projects/data-systems/', server.url).href);
  const toc = page.locator('.article-toc');
  await toc.waitFor();
  assert.equal(await toc.evaluate(n => n.open), false, 'The tablet TOC must start collapsed.');
  assert.equal(await toc.locator('summary').textContent(), 'On this page');
  await toc.locator('summary').tap();
  const chapter = toc.locator('a').nth(2), hash = await chapter.getAttribute('href');
  await chapter.tap();
  await page.waitForFunction(() => {
    const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    return heading && Math.abs(heading.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)) < 3;
  });
  assert.ok(page.url().endsWith(hash));
  assert.equal(await toc.evaluate(n => n.open), false, 'Selecting a chapter collapses the compact TOC before scrolling.');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForFunction(() => document.querySelector('.article-toc').open);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/en/', server.url).href);
  await page.waitForFunction(() => document.documentElement.classList.contains('motion-ready'));
  await page.locator('[data-motion-toggle]').tap();
  const layouts = await page.evaluate(() => window.__responsiveProbe.layouts);
  await page.evaluate(() => { for (let i = 0; i < 5; i++) dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__responsiveProbe.layouts), layouts, 'Unchanged layout dimensions must not regenerate the particle scene.');
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, '390-english-motion.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(previous => window.__responsiveProbe.layouts > previous && window.__responsiveProbe.state.revision > 1, layouts);
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.__responsiveProbe.glyphs.every(g => g.left >= -17 && g.right <= innerWidth + 17)), 'Rotated glyphs must still match the new text layout.');
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, '844-english-motion.png') });
  assert.deepEqual(errors, []);
  await context.close();

  const native = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false, locale: 'zh-CN' });
  const nativePage = await native.newPage();
  await nativePage.goto(server.url);
  assert.ok(await nativePage.locator('.site-nav a[href="/projects/"]').isVisible(), 'Navigation also works without JavaScript.');
  await nativePage.locator('.site-nav a[href="/projects/"]').tap();
  await nativePage.waitForURL('**/projects/');
  await native.close();
}

try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push({ size: `${width}x${height}`, error: error.message }));
    for (const locale of locales) for (const route of routes) {
      const localizedRoute = localePath(route, locale);
      await page.goto(new URL(localizedRoute, server.url).href);
      await page.waitForFunction(() => document.querySelector('.article-layout') ? document.querySelector('.article-toc') : true);
      const result = await page.evaluate(layoutEvidence);
      checked++;
      if (result.outside.length || result.textOverflow.length) failures.push({ size: `${width}x${height}`, route: localizedRoute, ...result });
      if (screenshotDir && [390, 820, 844].includes(width) && ['/', '/projects/data-systems/', '/collaborate/'].includes(route)) {
        await page.screenshot({ path: path.join(screenshotDir, `${locale}-${width}-${route === '/' ? 'home' : route.split('/').filter(Boolean).at(-1)}.png`), fullPage: route !== '/' });
        if (route === '/') await page.locator('#projects').screenshot({ path: path.join(screenshotDir, `${locale}-${width}-projects.png`) });
      }
    }
    await context.close();
  }
  if (!audit) await checkInteractions();
  console.log(JSON.stringify({ checked, interactions: audit ? 'skipped' : 'passed', failures }, null, 2));
  if (!audit) assert.equal(failures.length, 0, 'Responsive layout must fit its viewport.');
} finally {
  await browser.close();
  await server.close();
}
