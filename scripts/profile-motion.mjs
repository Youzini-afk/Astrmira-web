// Manual dev-server probe. Instrumentation is injected by Playwright only;
// none of it ships in the website or runs for visitors.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const rate = Number(args.rate || 1);
const viewport = { width: Number(args.width || 2550), height: Number(args.height || 1275) };
const names = ['sampleTextParticles', 'prepareTextIntro', 'prepareHeroTail', 'resizeStars', 'applyMotionQuality', 'updateGlyphLayers', 'paintCometTrail', 'paintParticlesAndStars', 'placeStar', 'tick'];
const browser = await chromium.launch({ headless: true, channel: args.browser || 'msedge' });
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: Number(args.dpr || 1.25) });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/src\/scripts\/astrmira\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = "  window.addEventListener('wheel', onHeroWheel";
    if (!body.includes(marker)) throw new Error('Motion probe injection point not found');
    const injection = `
      const __calls = [], __started = performance.now();
      const __wrap = (name, fn) => function(...args) {
        const start = performance.now(), opening = Boolean(introStart);
        try { return fn(...args); }
        finally { __calls.push({ name, start, cost: performance.now() - start, opening }); }
      };
      ${names.map(name => `${name} = __wrap('${name}', ${name});`).join('\n')}
      window.__motionProbe = () => ({ calls: __calls, started: __started, particles: textParticles.length,
        active: activeTextParticles.size, stars: stars.length, glyphs: glyphLayers.length,
        cells: glyphLayers.reduce((n, l) => n + l.cells.length, 0), quality: quality.name,
        settled: heroCopy?.classList.contains('is-solidified'), renderer: document.documentElement.dataset.particleRenderer,
        displayRate: framePacer.displayRate, targetRate: framePacer.targetRate });
    `;
    body = body.replace(marker, injection + '\n' + marker);
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await page.goto(args.url || 'http://localhost:4321/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6200);
  const { profile } = await cdp.send('Profiler.stop');
  const data = await page.evaluate(() => ({ ...window.__motionProbe(), longTasks: window.__longTasks }));
  const summarize = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { count: sorted.length, total: values.reduce((sum, n) => sum + n, 0), mean: values.reduce((sum, n) => sum + n, 0) / (values.length || 1), p95: sorted[Math.floor(sorted.length * .95)] || 0, max: sorted.at(-1) || 0 };
  };
  const functions = Object.fromEntries(names.map(name => [name, summarize(data.calls.filter(call => call.name === name).map(call => call.cost))]));
  const opening = data.calls.filter(call => call.name === 'tick' && call.opening);
  const frameGaps = opening.slice(1).map((call, i) => call.start - opening[i].start);
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const self = new Map();
  profile.samples.forEach((id, i) => {
    const frame = nodes.get(id).callFrame;
    const key = `${frame.functionName || '(anonymous)'}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + profile.timeDeltas[i] / 1000);
  });
  const { calls, ...state } = data;
  const result = { rate, viewport, dpr: Number(args.dpr || 1.25), browser: browser.version(), state, functions,
    openingFrames: summarize(opening.map(call => call.cost)), frameGaps: summarize(frameGaps),
    cpuTop: [...self].sort((a, b) => b[1] - a[1]).slice(0, 18), errors };
  if (args.output) await writeFile(args.output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(args.summary === 'true' ? {
    rate, renderer: state.renderer, particles: state.particles, quality: state.quality,
    displayRate: state.displayRate, targetRate: state.targetRate,
    longestTask: Math.max(0, ...state.longTasks.map(task => task.duration)),
    longTasks: state.longTasks.length, openingFrames: result.openingFrames,
    frameGaps: result.frameGaps, errors
  } : result, null, 2));
} finally { await browser.close(); }
