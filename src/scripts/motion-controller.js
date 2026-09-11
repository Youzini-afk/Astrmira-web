import { createCometPath, setCometDock, cometPoint } from './comet-path.js';
import { captureGlyphs, glyphSurfaceBounds } from './motion-layout.js';
import { getUi } from './ui.js';

// The document never receives per-particle data or GPU frame acknowledgements.
// It owns navigation and the companion transform; the worker owns the scene.
export function createMotionController(main) {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const finePointer = matchMedia('(pointer: fine)');
  const motionLabels = getUi().motion;
  const companion = $('.mira-object'), canvas = $('#particlefield'), root = document.documentElement;
  const glyphCanvas = document.createElement('canvas');
  glyphCanvas.className = 'hero-glyph-surface';
  glyphCanvas.setAttribute('aria-hidden', 'true');
  const mountedAt = performance.now();
  let worker, rendererReady = false, revision = 0, raf = 0, needsPublish = true, awaitingInput = false;
  let vw = innerWidth, vh = innerHeight, heroElement, heroCopy, heroBox = null, frameHeroRect = null;
  let sceneDpr = devicePixelRatio || 1;
  let cometPath, cometParam = null, cometUpdatedAt = null, cometWorld = { x: 0, y: 0 }, targetX = 0, targetY = 0;
  let cometDockElement, cometDockSurface, cometDockObserver, companionPose = '', companionAppearance = '', dockAppearance = '';
  let cometHasDeparted = false, cometStrands = [], openingPaths = [], openingMatrix = [1,0,0,1,0,0], pathDirty = true;
  let heroDeparture = null, exitWheelHeld = false, lastExitWheel = -Infinity, heroContentOpacity = 1, heroOpacityStyle = '';
  let introStart = 0, replay = 0, paused = false;
  let pointer = { x: -9999, y: -9999, vx: 0, vy: 0, sequence: 0 }, resizeTimer;
  try { paused = sessionStorage.getItem('astrmira-motion') === 'paused'; } catch (_) {}
  function seeded(n) {
    let value = n >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }


  const fallback = () => {
    rendererReady = false;
    root.classList.remove('motion-ready', 'motion-pending');
    root.dataset.particleRenderer = 'static';
    heroCopy?.classList.add('is-settled', 'is-solidified');
    introStart = 0;
    schedule();
  };
  try {
    if (canvas?.transferControlToOffscreen && typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./particle-worker.js', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      const glyphSurface = glyphCanvas.transferControlToOffscreen();
      worker.onmessage = ({ data }) => {
        if (data.type === 'prepared' && data.revision === revision) {
          rendererReady = true;
          const canOpen = !paused && window.scrollY < 1 && performance.now() - mountedAt < 1200;
          if (canOpen) startIntro();
          else { introStart = 0; heroCopy?.classList.add('is-settled', 'is-solidified'); }
          awaitingInput = false; publish();
        } else if (data.type === 'presented' && data.revision === revision) {
          root.classList.remove('motion-pending'); root.classList.add('motion-ready');
          root.dataset.particleRenderer = 'scene-worker';
        } else if (data.type === 'input-ready') {
          awaitingInput = false;
          if (needsPublish) schedule();
        } else if (data.type === 'unavailable') fallback();
        else if (data.type === 'restored') refresh();
      };
      worker.onerror = event => { event.preventDefault(); worker.terminate(); worker = null; fallback(); };
      worker.postMessage({ type: 'init', canvas: offscreen, glyphCanvas: glyphSurface }, [offscreen, glyphSurface]);
      root.classList.add('motion-pending');
    } else fallback();
  } catch (_) { worker?.terminate(); worker = null; fallback(); }

  function measureHero() {
    const r = heroElement?.getBoundingClientRect();
    heroBox = r ? { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height } : null;
  }

  async function refresh() {
    try { await refreshLayout(); }
    catch (error) { fallback(); console.warn('Motion layout unavailable:', error); }
  }

  async function refreshLayout() {
    const current = ++revision;
    heroElement = $('.hero'); heroCopy = $('.hero-copy');
    vw = canvas?.clientWidth || innerWidth; vh = canvas?.clientHeight || innerHeight;
    sceneDpr = devicePixelRatio || 1;
    measureHero(); prepareHeroTail(); observeCometDock(); updateMotionButtons();
    if (!worker) { fallback(); return; }
    // Read fonts once; subsequent frames never measure or rasterize text.
    if (document.fonts?.status === 'loading') await document.fonts.ready;
    if (current !== revision) return;
    measureHero();
    const glyphs = await captureGlyphs(heroElement);
    if (current !== revision || !worker) { glyphs.forEach(g => g.bitmap.close()); return; }
    const glyphBounds = glyphSurfaceBounds(glyphs, sceneDpr);
    if (heroElement && glyphs.length) {
      Object.assign(glyphCanvas.style, { left: `${glyphBounds.left}px`, top: `${glyphBounds.top}px`, width: `${glyphBounds.width}px`, height: `${glyphBounds.height}px` });
      heroElement.append(glyphCanvas);
    } else glyphCanvas.remove();
    rendererReady = false; pathDirty = true;
    placeStar(true);
    const layout = { width: vw, height: vh, dpr: sceneDpr, hero: heroBox,
      path: cometPath, matrix: openingMatrix, openingPaths, strands: cometStrands, glyphs, glyphBounds };
    worker.postMessage({ type: 'layout', revision, layout, state: state() }, glyphs.map(g => g.bitmap));
    schedule();
  }
  function heroStarAnchor(rect) {
    if (matchMedia('(max-height: 500px) and (min-width: 600px) and (max-width: 1100px)').matches) {
      return { x: rect.left + rect.width * .84, y: rect.top + rect.height * .5 };
    }
    if (vw <= 720) {
      return { x: rect.left + rect.width * .78, y: rect.top + Math.min(135, rect.height * .2) };
    }
    return {
      x: rect.left + rect.width * .79,
      y: rect.top + rect.height * .265
    };
  }

  function prepareHeroTail() {
    const sky = $('.hero-sky');
    const group = $('[data-star-tail]', sky || document);
    const route = $('[data-star-route]', group || document);
    const hero = $('.hero');
    const rect = hero?.getBoundingClientRect();
    const matrix = sky?.getScreenCTM();
    const opening = [];
    cometStrands = [];
    openingPaths = []; openingMatrix = [1,0,0,1,0,0];
    if (rect && group && route && matrix) {
      const length = route.getTotalLength();
      const start = route.getPointAtLength(0), end = route.getPointAtLength(length);
      const anchor = heroStarAnchor(rect);
      const inverse = matrix.inverse();
      const localStart = new DOMPoint(rect.left - 60, rect.top + rect.height * .9).matrixTransform(inverse);
      const localEnd = new DOMPoint(anchor.x, anchor.y).matrixTransform(inverse);
      const scaleX = (localEnd.x - localStart.x) / (end.x - start.x);
      const scaleY = (localEnd.y - localStart.y) / (end.y - start.y);
      group.setAttribute('transform', `translate(${localStart.x - start.x * scaleX} ${localStart.y - start.y * scaleY}) scale(${scaleX} ${scaleY})`);
      $$('path', group).forEach(path => path.setAttribute('pathLength', '1'));
      const routeMatrix = route.getScreenCTM();
      const steps = Math.ceil(length / 8);
      for (let i = 0; i <= steps; i++) {
        const p = route.getPointAtLength(length * i / steps);
        const screen = new DOMPoint(p.x, p.y).matrixTransform(routeMatrix);
        opening.push({ x: screen.x + window.scrollX, y: screen.y + window.scrollY, u: i / steps });
      }
      const dx = opening[1].x - opening[0].x, dy = opening[1].y - opening[0].y;
      const tangent = Math.hypot(dx, dy);
      const strokeScale = Math.sqrt(Math.abs(routeMatrix.a * routeMatrix.d - routeMatrix.b * routeMatrix.c));
      cometStrands = $$('path', group).map(path => {
        const p = path.getPointAtLength(0);
        const origin = new DOMPoint(p.x, p.y).matrixTransform(routeMatrix);
        return {
          offset: ((origin.x + window.scrollX - opening[0].x) * -dy + (origin.y + window.scrollY - opening[0].y) * dx) / tangent,
          color: path.getAttribute('stroke'),
          alpha: Number(path.getAttribute('stroke-opacity')),
          width: Number(path.getAttribute('stroke-width')) * strokeScale
        };
      });

      openingMatrix = [routeMatrix.a, routeMatrix.b, routeMatrix.c, routeMatrix.d, routeMatrix.e + window.scrollX, routeMatrix.f + window.scrollY];
      openingPaths = $$('path', group).map((p, i) => ({ ...cometStrands[i], d: p.getAttribute('d') }));
      // The SVG supplies the design at initialization; the GPU owns the live wake.
      group.setAttribute('opacity', '0');
    } else if (rect) {
      const anchor = heroStarAnchor(rect);
      opening.push({ x: anchor.x, y: anchor.y + window.scrollY, u: 1 });
    }
    if (!cometStrands.length) {
      const random = seeded(7261);
      cometStrands = Array.from({ length: 72 }, (_, i) => ({
        offset: (i / 71 - .5) * Math.min(vw * .18, 180),
        color: ['#c5ab81', '#719dc4', '#9dbbd6'][Math.floor(random() * 3)],
        alpha: .025 + random() * .075,
        width: .3 + random() * 1.2
      }));
    }
    cometPath = createCometPath(opening, { width: document.documentElement.clientWidth, height: vh, heroBottom: rect ? rect.bottom + window.scrollY : 0 });
    cometDockElement = $('[data-comet-dock]');
    cometDockSurface = cometDockElement?.closest('.origin-art');
    refreshCometDock();
    cometParam = null;
    cometUpdatedAt = null;
    cometHasDeparted = window.scrollY > 0;
  }


  function refreshCometDock() {
    if (!cometPath || !cometDockElement) return false;
    const rect = cometDockElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const destination = {
      x: rect.left + rect.width / 2 + window.scrollX,
      y: rect.top + rect.height / 2 + window.scrollY,
      // The companion core has radius 66 in its 400-unit SVG viewBox.
      scale: rect.width / 2 / ((companion?.offsetWidth || 370) * 66 / 400)
    };
    const previous = cometPath.dock;
    if (previous && Math.abs(previous.x - destination.x) < .1 && Math.abs(previous.y - destination.y) < .1 && Math.abs(previous.scale - destination.scale) < .001) return false;
    setCometDock(cometPath, destination);
    pathDirty = true;
    return true;
  }

  function observeCometDock() {
    cometDockObserver?.disconnect();
    if (!cometDockElement) return;
    // Remeasure only when content or the illustration changes size, not on
    // every animation frame. This also covers fonts and responsive reflow.
    cometDockObserver = new ResizeObserver(() => {
      measureHero();
      if (!refreshCometDock()) return;
      cometParam = cometUpdatedAt = null;
      schedule();
    });
    cometDockObserver.observe(main);
    cometDockObserver.observe(cometDockElement.ownerSVGElement);
  }


  function updateStarTarget(immediate = false, now = performance.now()) {
    if (!cometPath) return;
    const hero = heroElement;
    frameHeroRect = heroBox ? { left: heroBox.left - window.scrollX, top: heroBox.top - window.scrollY,
      bottom: heroBox.top + heroBox.height - window.scrollY, width: heroBox.width, height: heroBox.height } : null;
    const desired = Math.min(cometPath.dock?.end ?? Infinity, cometPath.heroLength + Math.max(0, window.scrollY));
    if (introStart) cometParam = cometPath.heroLength * smoothstep((now - introStart - 200) / 3300);
    else if (heroDeparture) cometParam = heroDeparture.cometFrom + (cometPath.heroLength + heroDeparture.destination - heroDeparture.cometFrom) * heroDeparture.progress;
    else if (immediate || paused || cometUpdatedAt === null) cometParam = desired;
    else cometParam += (desired - cometParam) * (1 - Math.exp(-Math.max(0, now - cometUpdatedAt) / 110));
    if (desired === cometPath.dock?.end && Math.abs(desired - cometParam) < .05) cometParam = desired;
    cometUpdatedAt = now;
    cometWorld = cometPoint(cometPath, cometParam);
    targetX = cometWorld.x - window.scrollX;
    targetY = cometWorld.y - window.scrollY;
    if (!introStart && window.scrollY > 0) cometHasDeparted = true;
    let progress = 1;
    if (hero) {
      const rect = frameHeroRect;
      progress = clamp(window.scrollY / Math.max(1, rect.bottom + window.scrollY), 0, 1);
      heroContentOpacity = paused ? 1 : 1 - smoothstep((progress - .08) / .76);
      const opacity = heroContentOpacity.toFixed(3);
      if (opacity !== heroOpacityStyle) { hero.style.setProperty('--hero-exit-opacity', opacity); heroOpacityStyle = opacity; }
    } else {
      heroContentOpacity = 1;
    }
    if (companion) {
      const blend = smoothstep(progress);
      const depth = (cometWorld.depth + 1) / 2;
      const scale = (vw < 720 ? .35 : .4) + depth * .15;
      const docking = cometWorld.docking || 0;
      const flyingScale = .72 + (scale - .72) * blend;
      const flyingOpacity = .9 + (.42 + depth * .38 - .9) * blend;
      if (!companion.classList.contains('has-comet-motion')) companion.classList.add('has-comet-motion');
      companion.classList.toggle('is-docked', docking === 1);
      const opacity = (flyingOpacity + (.95 - flyingOpacity) * docking).toFixed(3);
      const size = (flyingScale + ((cometPath.dock?.scale ?? flyingScale) - flyingScale) * docking).toFixed(3);
      const dock = docking.toFixed(3), appearance = `${opacity}:${size}:${dock}`;
      if (appearance !== companionAppearance) {
        companion.style.setProperty('--companion-opacity', opacity);
        companion.style.setProperty('--companion-scale', size);
        companion.style.setProperty('--companion-dock', dock);
        companionAppearance = appearance;
      }
      if (dock !== dockAppearance) { cometDockSurface?.style.setProperty('--comet-dock', dock); dockAppearance = dock; }
    }
  }


  function cancelHeroDeparture() {
    if (heroDeparture) window.scrollTo({ top: window.scrollY, behavior: 'instant' });
    heroDeparture = null;
    exitWheelHeld = false;
    schedule();
  }

  function beginHeroDeparture(hero) {
    const from = window.scrollY;
    const rect = hero.getBoundingClientRect();
    const distance = rect.bottom;
    // Yield the opening to the visitor's navigation intent. The glyph masks
    // still blend into their settled state while the whole hero fades away.
    introStart = 0;
    heroCopy?.classList.add('is-settled', 'is-solidified');
    pointer = { x: -9999, y: -9999, vx: 0, vy: 0, sequence: pointer.sequence + 1 };
    if (paused) {
      window.scrollTo({ top: from + distance, behavior: 'instant' });
      placeStar(true);
      publish();
      return;
    }
    heroDeparture = {
      hero, from, destination: from + distance, cometFrom: cometParam,
      heroBox: { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height },
      progress: 0
    };
    // The browser's compositor owns scrolling. The companion follows the
    // actual scroll position instead of driving the document from a JS clock.
    window.scrollTo({ top: heroDeparture.destination, behavior: 'smooth' });
    schedule();
  }

  function advanceHeroDeparture(now) {
    const departure = heroDeparture;
    if (!departure) return false;
    if (!departure.hero.isConnected) { cancelHeroDeparture(); return false; }
    departure.progress = clamp((window.scrollY - departure.from) / Math.max(1, departure.destination - departure.from), 0, 1);
    return window.scrollY >= departure.destination - 1;
  }

  function onHeroWheel(event) {
    if (event.defaultPrevented) return;
    if (event.target.closest?.('.site-nav.is-open, [data-language-picker][open]')) return;
    if (event.ctrlKey || event.deltaY < 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      cancelHeroDeparture();
      return;
    }
    if (event.deltaY <= 0 || !event.cancelable) return;
    const now = performance.now();
    // A brief quiet interval separates a fresh wheel gesture from the tail of
    // the gesture that launched the transition, preventing landing overshoot.
    if (heroDeparture || (exitWheelHeld && now - lastExitWheel < 160)) {
      event.preventDefault();
      lastExitWheel = now;
      return;
    }
    exitWheelHeld = false;
    const hero = $('.hero');
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom <= 1 || rect.top >= innerHeight) return;
    event.preventDefault();
    exitWheelHeld = true;
    lastExitWheel = now;
    beginHeroDeparture(hero);
  }


  function placeStar(immediate = false, now = performance.now()) {
    updateStarTarget(immediate, now);
    if (companion) {
      const pose = `translate3d(${targetX.toFixed(2)}px, ${targetY.toFixed(2)}px, 0) translate(-50%, -50%)`;
      if (pose !== companionPose) {
        companion.style.left = companion.style.top = '0'; companion.style.transform = pose; companionPose = pose;
      }
    }
  }
  function state() {
    return { revision, scrollX, scrollY, paused, hidden: document.hidden, param: cometParam || 0,
      introEpoch: introStart ? performance.timeOrigin + introStart : 0, replay, pointer, heroOpacity: heroContentOpacity,
      departure: Boolean(heroDeparture), ...(pathDirty ? { path: cometPath } : {}) };
  }
  function publish() {
    needsPublish = true;
    if (!worker || !rendererReady || awaitingInput) return;
    awaitingInput = true; needsPublish = false;
    worker.postMessage({ type: 'input', state: state() }); pathDirty = false;
  }
  function tick(now) {
    raf = 0;
    const departed = advanceHeroDeparture(now);
    placeStar(false, now);
    if (introStart && now - introStart > 3500 && !heroCopy?.classList.contains('is-settled')) heroCopy?.classList.add('is-settled');
    if (introStart && now - introStart >= 4800) { introStart = 0; heroCopy?.classList.add('is-solidified'); }
    if (departed) heroDeparture = null;
    publish();
    // A still document needs no main-thread animation loop. Stars continue
    // breathing on the worker's independent requestAnimationFrame.
    const desired = Math.min(cometPath?.dock?.end ?? Infinity, (cometPath?.heroLength || 0) + Math.max(0, scrollY));
    if (!paused && (introStart || heroDeparture || Math.abs(desired - (cometParam || 0)) > .05)) schedule();
  }
  function schedule() { needsPublish = true; if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }
  function startIntro() {
    if (paused || !heroElement || !rendererReady) return;
    introStart = performance.now(); replay++;
    heroCopy.classList.remove('is-solidified', 'is-settled');
    cometParam = 0; cometUpdatedAt = null;
    placeStar(true, introStart); publish(); schedule();
  }
  function updateMotionButtons() {
    document.documentElement.classList.toggle('is-paused', paused);
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.disabled = false;
    });
    $$('[data-motion-text]').forEach(el => el.textContent = paused ? motionLabels.enable : motionLabels.pause);
    $$('[data-replay]').forEach(button => button.disabled = false);
  }


  const toggle = () => {
    paused = !paused;
    if (paused) introStart = 0;
    try { sessionStorage.setItem('astrmira-motion', paused ? 'paused' : 'active'); } catch (_) {}
    if (paused) heroCopy?.classList.add('is-settled', 'is-solidified');
    updateMotionButtons(); publish(); schedule();
  };
  window.addEventListener('wheel', onHeroWheel, { passive: false });
  window.addEventListener('pointerdown', cancelHeroDeparture, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape','Tab'].includes(event.key)) cancelHeroDeparture();
  });
  window.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch' || paused) return;
    pointer = { x: event.clientX, y: event.clientY,
      vx: pointer.x > -1000 ? (event.clientX - pointer.x) * .4 : 0,
      vy: pointer.y > -1000 ? (event.clientY - pointer.y) * .4 : 0, sequence: pointer.sequence + 1 };
    schedule();
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    pointer = { x: -9999, y: -9999, vx: 0, vy: 0, sequence: pointer.sequence + 1 }; schedule();
  });
  window.addEventListener('scroll', () => {
    // Native touch scrolling can start before the opening finishes. Release
    // its clock and ease from the current star position into the scroll path.
    if (introStart && window.scrollY > 1) {
      introStart = 0;
      heroCopy?.classList.add('is-settled', 'is-solidified');
    }
    schedule();
  }, { passive: true });
  window.addEventListener('resize', () => {
    // The canvas uses stable large-viewport units. Toolbar and keyboard
    // changes need no new glyph bitmaps, particles, or comet history.
    if (vw === (canvas?.clientWidth || innerWidth) && vh === (canvas?.clientHeight || innerHeight) && sceneDpr === (devicePixelRatio || 1)) {
      schedule(); return;
    }
    cancelHeroDeparture(); clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 100);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      introStart = 0; heroCopy?.classList.add('is-settled', 'is-solidified');
      // Send immediately even when no document frame will be scheduled.
      if (worker) worker.postMessage({ type: 'input', state: state() });
    } else { cometUpdatedAt = null; schedule(); }
  });
  window.addEventListener('pagehide', event => { if (!event.persisted) worker?.terminate(); });
  window.addEventListener('pageshow', event => { if (event.persisted) schedule(); });
  return { refresh, toggle, replay() { paused = false; updateMotionButtons(); startIntro(); },
    get paused() { return paused; } };
}
