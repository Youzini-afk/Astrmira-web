// Measure the same user journey on any built revision, without internal hooks.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { serveMotionBuild, installMainProbe } from './motion-browser-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const rate = Number(args.rate || 1);
const server = await serveMotionBuild(args.root || 'dist');
const browser = await chromium.launch({ headless: true, channel: args.browser || 'msedge' });
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, total: values.reduce((a, b) => a + b, 0), mean: values.reduce((a, b) => a + b, 0) / (values.length || 1), p95: sorted[Math.floor(sorted.length * .95)] || 0, max: sorted.at(-1) || 0 };
};
try {
  const page = await browser.newPage({ viewport: { width: Number(args.width || 2550), height: Number(args.height || 1275) }, deviceScaleFactor: Number(args.dpr || 1.25), locale: args.locale || 'zh-CN' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(installMainProbe);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(server.url);
  await page.waitForTimeout(6200);
  const opening = await page.evaluate(() => window.__motionEvidence);
  await page.evaluate(() => { window.__motionEvidence.callbacks = []; window.__motionEvidence.tasks = []; window.__motionEvidence.scrollCalls = 0; });
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(1600);
  const departure = await page.evaluate(() => ({ ...window.__motionEvidence, y: scrollY, target: document.querySelector('.hero').getBoundingClientRect().bottom + scrollY }));
  const worker = page.workers().find(w => w.url().includes('particle-worker'));
  const evidence = worker ? await worker.evaluate(() => self.__motionEvidence) : null;
  const result = {
    browser: browser.version(), rate,
    renderer: await page.evaluate(() => document.documentElement.dataset.particleRenderer),
    opening: { callbacks: summarize(opening.callbacks.map(c => c.cost)), longTasks: opening.tasks, readbacks: opening.readbacks, particleTransfers: opening.particleTransfers },
    departure: { callbacks: summarize(departure.callbacks.map(c => c.cost)), longTasks: departure.tasks, scrollCalls: departure.scrollCalls, landed: Math.abs(departure.y - departure.target) < 2 },
    worker: evidence ? { draws: evidence.draws, callbacks: summarize(evidence.callbacks.map(c => c.cost)), maskBytes: evidence.maskBytes } : null,
    errors
  };
  if (args.output) await writeFile(args.output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await server.close(); }
