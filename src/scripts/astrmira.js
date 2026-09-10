import { createCometPath, setCometDock, cometPoint, createCometTrail, recordCometMotion, fadeCometTrail, visibleCometTrailSegments, cometTurnOpacity } from './comet-path.js';
import { createMotionQuality, nextFrameTime } from './motion-quality.js';
import { createParticleGrid } from './particle-grid.js';
import { mountArticleTocs } from './article-toc.js';
import { mountPaperCarousels } from './paper-carousel.js';
import { createParticlePainter } from './particle-painter.js';
import { createNearestParticleLookup } from './nearest-particle.js';
import { setGlyphCoverage, sampleGlyphCoverage } from './glyph-coverage.js';

/* Astrmira — progressive enhancement. No network requests, no external runtime. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const standalone = document.body.dataset.mode === 'standalone';
  const main = $('#main');
  let filterResearch = 'all';
  let queryY = 154;
  let agentStage = 0;
  let brief = '';
  let copiedTimer;
  let paused = reduced.matches;
  try { paused = reduced.matches || sessionStorage.getItem('astrmira-motion') === 'paused'; } catch (_) { /* Sandboxed browsers may disable storage. */ }
  let disposeArticleTocs = () => {};
  let disposePaperCarousels = () => {};

  function initPage({ focus = false } = {}) {
    disposeArticleTocs();
    disposeArticleTocs = mountArticleTocs(main, () => paused || reduced.matches);
    disposePaperCarousels();
    disposePaperCarousels = mountPaperCarousels(main, () => paused || reduced.matches);
    heroElement = $('.hero');
    heroCopy = $('.hero-copy');
    filterResearch = 'all'; queryY = 154; agentStage = 0; brief = '';
    const route = main?.dataset.route || 'home';
    $$('.site-nav [data-route]').forEach(a => {
      if (route === a.dataset.route || route.startsWith(a.dataset.route + '/')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    $('.site-nav')?.classList.remove('is-open');
    drawQuant(3); drawAgent(); updateMotionButtons();
    if (focus) main?.focus({ preventScroll: true });
    resizeStars({ render: false });
    observeCometDock();
  }

  function go(route, push = true) {
    if (!standalone) return;
    const template = document.getElementById('page-' + route.replaceAll('/', '--'));
    if (!template || !main) return;
    main.replaceChildren(template.content.cloneNode(true));
    main.dataset.route = route;
    const titles = $('#route-titles');
    if (titles) {
      try { document.title = JSON.parse(titles.textContent)[route] || 'Astrmira'; } catch (_) {}
    }
    if (push) history.pushState({ route }, '', '#/' + (route === 'home' ? '' : route));
    window.scrollTo({ top: 0, behavior: 'instant' });
    initPage({ focus: true });
  }
  window.addEventListener('popstate', () => {
    if (!standalone) return;
    const route = location.hash.startsWith('#/') ? location.hash.slice(2) || 'home' : 'home';
    go(route, false);
  });

  function activateTab(key, focus = false) {
    const target = $('[data-lab-tab="' + key + '"]');
    if (!target) return;
    $$('[data-lab-tab]').forEach(tab => {
      const active = tab === target;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) target.focus();
    if (key === 'quant') drawQuant(Number($('[data-bits-range]')?.value || 3));
    if (key === 'agent') drawAgent();
  }

  function moveQuery(x, y = queryY, announce = true) {
    const svg = $('[data-lab-svg="vector"]');
    if (!svg) return;
    x = clamp(x, 50, 500); y = clamp(y, 30, 275); queryY = y;
    const points = $$('[data-point]', svg).map(el => ({
      el, x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy'))
    }));
    const nearest = points.map((p, i) => ({ i, d: (p.x - x) ** 2 + (p.y - y) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 5).map(p => p.i);
    points.forEach((p, i) => {
      p.el.setAttribute('fill', nearest.includes(i) ? '#d6b881' : '#7792af');
      p.el.setAttribute('r', nearest.includes(i) ? '3' : '2');
      p.el.setAttribute('opacity', nearest.includes(i) ? '1' : '.6');
    });
    $('[data-neighbor-lines]', svg).innerHTML = nearest.map(i =>
      `<path d="M${x.toFixed(2)} ${y.toFixed(2)}L${points[i].x} ${points[i].y}" stroke="#d6b881" stroke-opacity=".6" stroke-width=".8"/>`).join('');
    $('[data-query]', svg).setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const range = $('[data-query-range]'); if (range) range.value = String(Math.round(x));
    const feedback = $('[data-query-feedback]');
    if (announce && feedback) feedback.textContent = `查询点已更新 · 重新选出了距离最近的 5 个数据点。`;
  }

  function drawQuant(bits) {
    const svg = $('[data-lab-svg="quant"]'); if (!svg) return;
    bits = clamp(Math.round(bits), 1, 6); const levels = 2 ** bits;
    let original = '', quantized = '';
    for (let i = 0; i <= 180; i++) {
      const x = 42 + (i / 180) * 472;
      const value = clamp(.5 + .28 * Math.sin(i / 22) + .105 * Math.sin(i / 9.8), 0, 1);
      const q = Math.round(value * (levels - 1)) / (levels - 1);
      original += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(247 - value * 194).toFixed(1)} `;
      quantized += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(247 - q * 194).toFixed(1)} `;
    }
    let grid = '';
    for (let i = 0; i < Math.min(levels, 32); i++) {
      const y = 247 - i / (Math.min(levels, 32) - 1) * 194;
      grid += `<path d="M42 ${y.toFixed(1)}H516" stroke="#a1b7cf" stroke-opacity=".1" stroke-width=".5"/>`;
    }
    svg.innerHTML = `${grid}<path d="M42 35V263H522" stroke="#a1b7cf" stroke-opacity=".25" stroke-width=".7"/><path d="${original}" fill="none" stroke="#90acc9" stroke-opacity=".6" stroke-width="1.2"/><path d="${quantized}" fill="none" stroke="#d6b881" stroke-width="1.4"/><text x="44" y="24" fill="#8797ac" font-size="9" font-family="monospace">VALUE</text><text x="470" y="285" fill="#8797ac" font-size="9" font-family="monospace">SAMPLE</text><text x="399" y="30" fill="#d6b881" font-size="11" font-family="monospace">${levels} LEVELS / ${bits} BIT</text>`;
    const output = $('[data-bits-output]'); if (output) output.textContent = bits + ' bit';
    const feedback = $('[data-quant-feedback]'); if (feedback) feedback.textContent = `${levels} 个表示等级`;
  }

  const stages = ['理解任务', '制定计划', '调用工具', '检查结果', '交付结果'];
  function drawAgent() {
    const svg = $('[data-lab-svg="agent"]'); if (!svg) return;
    const nodes = [[77,150],[196,86],[346,86],[459,150],[290,223]];
    let graph = '<defs><marker id="agent-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L7 4 1 7" fill="none" stroke="#7188a1"/></marker></defs>';
    const paths = ['M100 137L170 99','M228 86H315','M371 101L436 137','M434 166L320 209'];
    graph += paths.map((d,i)=>`<path d="${d}" fill="none" stroke="${i < agentStage ? '#d6b881' : '#7188a1'}" stroke-opacity=".55" stroke-width=".9" marker-end="url(#agent-arrow)"/>`).join('');
    graph += '<path d="M453 177C485 286 104 310 178 119" fill="none" stroke="#829ab3" stroke-opacity=".23" stroke-width=".7" stroke-dasharray="3 6" marker-end="url(#agent-arrow)"/><text x="125" y="279" fill="#788aa0" font-size="9" font-family="sans-serif">检查未通过时，修订计划</text>';
    nodes.forEach(([x,y],i)=>{
      const active = i === agentStage;
      graph += `<g><circle cx="${x}" cy="${y}" r="${active ? 33 : 27}" fill="${active ? '#25251f' : '#111923'}" stroke="${active ? '#d6b881' : '#7188a1'}" stroke-opacity="${active ? '.9' : '.5'}" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="${active ? 4 : 2.5}" fill="${active ? '#d6b881' : '#7188a1'}"/><text x="${x}" y="${y+(i<3 ? -43 : 48)}" text-anchor="middle" fill="${active ? '#d6b881' : '#8d9cb0'}" font-size="11" font-family="sans-serif">${stages[i]}</text></g>`;
    });
    graph += '<rect x="291" y="19" width="110" height="23" rx="0" fill="#d6b881" fill-opacity=".03" stroke="#d6b881" stroke-opacity=".2"/><text x="346" y="34" text-anchor="middle" fill="#b8a687" font-size="9" font-family="sans-serif">关键操作 · 人类确认</text><path d="M346 42V53" stroke="#d6b881" stroke-opacity=".4" stroke-dasharray="2 3"/>';
    svg.innerHTML = graph;
    const title = $('[data-agent-stage]'); if (title) title.textContent = stages[agentStage];
    const feedback = $('[data-agent-feedback]');
    if (feedback) feedback.textContent = [
      '理解任务：明确目标、约束与可用上下文。',
      '制定计划：把目标拆解为可检查的步骤。',
      '调用工具：在明确权限后执行，关键操作需确认。',
      '检查结果：验证输出；必要时回到计划阶段。',
      '交付结果：整理输出与执行记录。'
    ][agentStage];
    const step = $('[data-agent-step]'); if (step) step.textContent = agentStage === 4 ? '再看一次 ↺' : agentStage === 2 ? '模拟确认并继续 →' : '下一步 →';
  }

  function filterProjects(value) {
    let count = 0;
    $$('[data-project-directory] .project-card').forEach(card => {
      card.hidden = value !== 'all' && value !== card.dataset.category;
      if (!card.hidden) count++;
    });
    $$('[data-project-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === value)));
    const output = $('[data-project-count]'); if (output) output.textContent = `${count} 项`;
  }
  function filterResearchItems() {
    let count = 0;
    const term = ($('[data-research-search]')?.value || '').trim().toLocaleLowerCase();
    $$('[data-research-directory] [data-research-item]').forEach(item => {
      const matchFilter = filterResearch === 'all' || (item.dataset.theme || '').split(' ').includes(filterResearch);
      const matchSearch = (item.dataset.search || '').toLocaleLowerCase().includes(term);
      item.hidden = !(matchFilter && matchSearch); if (!item.hidden) count++;
    });
    $$('[data-research-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchFilter === filterResearch)));
    const empty = $('[data-empty-search]'); if (empty) empty.hidden = count > 0;
    const output = $('[data-research-count]'); if (output) output.textContent = `${count} 篇论文`;
  }

  // One delegated listener remains valid after single-file preview navigation.
  document.addEventListener('click', async e => {
    const target = e.target instanceof Element ? e.target : null; if (!target) return;
    const routeLink = target.closest('a[data-route]');
    if (routeLink && standalone && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault(); go(routeLink.dataset.route); return;
    }
    if (target.closest('[data-menu-toggle]')) {
      const button = $('[data-menu-toggle]');
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open)); $('.site-nav')?.classList.toggle('is-open', open); return;
    }
    if (target.closest('[data-back-top]')) { e.preventDefault(); window.scrollTo({top:0,behavior:paused ? 'instant' : 'smooth'}); main?.focus({preventScroll:true}); return; }
    const tab = target.closest('[data-lab-tab]'); if (tab) { activateTab(tab.dataset.labTab); return; }
    if (target.closest('[data-query-reset]')) { moveQuery(288,154); return; }
    const vector = target.closest('[data-lab-svg="vector"]');
    if (vector) {
      const ctm = vector.getScreenCTM();
      if (ctm) { const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse()); moveQuery(p.x,p.y); } return;
    }
    if (target.closest('[data-agent-step]')) { agentStage = (agentStage+1)%5; drawAgent(); return; }
    if (target.closest('[data-agent-reset]')) { agentStage = 0; drawAgent(); return; }
    const pf = target.closest('[data-project-filter]'); if (pf) { filterProjects(pf.dataset.projectFilter); return; }
    const rf = target.closest('[data-research-filter]'); if (rf) { filterResearch = rf.dataset.researchFilter; filterResearchItems(); return; }
    if (target.closest('[data-replay]')) { if (!reduced.matches) { paused = false; updateMotionButtons(); startIntro(); startLoop(); } return; }
    if (target.closest('[data-motion-toggle]')) {
      paused = !paused;
      if (reduced.matches) paused = true;
      try { sessionStorage.setItem('astrmira-motion', paused ? 'paused' : 'active'); } catch (_) {}
      if (paused) introStart = 0;
      updateMotionButtons(); startLoop(); return;
    }
    if (target.closest('[data-copy-brief]') && brief) {
      const status = $('[data-brief-status]');
      try {
        await navigator.clipboard.writeText(brief);
        if (status) status.textContent = '已复制到剪贴板。简报仍未发送。';
      } catch (_) {
        const pre = $('[data-brief-text]');
        const selection = window.getSelection(); const range = document.createRange();
        range.selectNodeContents(pre); selection.removeAllRanges(); selection.addRange(range);
        if (status) status.textContent = '浏览器未允许自动复制。已选中文本，请使用系统复制命令。';
      }
      clearTimeout(copiedTimer); return;
    }
    if (target.closest('[data-download-brief]') && brief) {
      const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'Astrmira-合作简报.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.matches('[data-query-range]')) moveQuery(Number(t.value),queryY);
    if (t.matches('[data-bits-range]')) drawQuant(Number(t.value));
    if (t.matches('[data-research-search]')) filterResearchItems();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const toggle = $('[data-menu-toggle]');
      if (toggle?.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded','false'); $('.site-nav')?.classList.remove('is-open'); toggle.focus();
      }
    }
    if (!e.target.matches?.('[data-lab-tab]')) return;
    const keys=['vector','quant','agent']; const i=keys.indexOf(e.target.dataset.labTab);
    const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;
    if(next>=0){e.preventDefault();activateTab(keys[next],true);}
  });
  document.addEventListener('submit', e => {
    const form=e.target;if(!form.matches?.('[data-brief-form]'))return;
    e.preventDefault(); if(!form.reportValidity())return;
    const data=new FormData(form);
    brief=`Astrmira · 合作简报\n\n称呼：${String(data.get('name')||'未填写').trim()}\n组织 / 团队：${String(data.get('organization')||'未填写').trim()}\n合作方向：${data.get('area')}\n\n问题与目标：\n${String(data.get('problem')||'').trim()}\n\n——\n此简报在当前浏览器中生成，尚未发送。`;
    $('[data-brief-text]').textContent=brief;
    $('[data-brief-result]').hidden=false;
    $('[data-brief-status]').textContent='简报已在本地生成，尚未发送。';
    $('[data-brief-result]').scrollIntoView({behavior:paused?'instant':'smooth',block:'nearest'});
  });

  const companion = $('.mira-object');
  let heroTail = null;
  let heroDeparture = null;
  let exitWheelHeld = false, lastExitWheel = -Infinity;
  let heroContentOpacity = 1;
  let heroOpacityStyle = '';
  let cometPath = null, cometParam = null, cometUpdatedAt = null;
  let cometDockElement = null, cometDockSurface = null, cometDockObserver = null;
  let companionPose = '', companionAppearance = '', dockAppearance = '';
  let cometHasDeparted = false;
  let cometStrands = [];
  let cometTrail = createCometTrail(Math.hypot(innerWidth, innerHeight) * .82);
  let trailPaintState = null;
  let introStart = 0, raf = 0, lastFrame = 0;
  let starX = innerWidth * .78, starY = innerHeight * .31, targetX = starX, targetY = starY;
  let prevStarX = starX, prevStarY = starY;
  let cometWorld = { x: starX, y: starY, depth: 1 };
  let prevCometX = starX, prevCometY = starY;
  let pointerX = 0, pointerY = 0;
  let mouseX = -9999, mouseY = -9999, mouseVx = 0, mouseVy = 0, lastMouseX = -9999, lastMouseY = -9999;
  let maskRadius = 0, targetMaskRadius = 0, maskX = -9999, maskY = -9999, targetMaskX = -9999, targetMaskY = -9999;
  const starCanvas = $('#starfield');
  const starCtx = starCanvas?.getContext('2d');
  const particlePainter = createParticlePainter(starCtx, $('#particlefield'), () => startLoop());
  let stars = [], textParticles = [], vw = innerWidth, vh = innerHeight;
  let allTextParticles = [], allIntroQueue = [], introQueue = [], introCursor = 0, appliedTextBudget = null;
  let glyphLayers = [];
  let heroElement = $('.hero'), heroCopy = $('.hero-copy'), frameHeroRect = null;
  let particleGrid = createParticleGrid([]), activeTextParticles = new Set();
  const motionQuality = createMotionQuality({ cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory });
  let quality = motionQuality.current, sampledTextDensity = quality.text;
  let renderStars = [], renderStrands = [], cometSparkBudget = 0, textSparkBudget = 0;
  let sceneBusy = false, pendingQuality = null;
  let textOriginX = 0, textOriginY = 0;
  let stardustSparks = [];
  let lastPaint = 0;
  const INTRO_DURATION = 4800;
  const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function seeded(n) {
    let value = n >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  const VAN_GOGH_PALETTE = [
    [226, 192, 133], // warm luminous gold (#e2c085)
    [248, 220, 160], // amber yellow (#f8dca0)
    [142, 184, 216], // celestial sky cyan (#8eb8d8)
    [72, 122, 168],  // deep impressionist cobalt (#487aa8)
    [206, 172, 120], // star trail ochre (#ceac78)
    [252, 206, 116], // radiant solar flame (#fcce74)
    [108, 156, 196]  // cerulean brushstroke (#6c9cc4)
  ];

  function prepareTextIntro(heroRect) {
    const rand = seeded(1947);
    const titlePoints = textParticles.filter(p => p.isTitle);
    const copyPoints = textParticles.filter(p => !p.isTitle);
    const gathered = [];
    stars.forEach(s => { s.textParticle = null; });
    textParticles.forEach(p => { p.sourceStar = null; });

    // Recruit a minority of the existing sky. The other stars keep their
    // positions and motion throughout the opening, rather than being replaced.
    for (const s of stars) {
      if (!s.gathers) continue;
      const pool = rand() < 0.82 && titlePoints.length ? titlePoints : copyPoints;
      if (!pool.length) continue;
      const p = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      s.textParticle = p;
      p.sourceStar = s;
      p.startRelX = s.x - heroRect.left;
      p.startRelY = s.y - heroRect.top;
      p.delay = 420 + rand() * 1200;
      p.travelDuration = 1650 + rand() * 1050;
      p.bend = (rand() - 0.5) * Math.min(150, Math.hypot(p.relX - p.startRelX, p.relY - p.startRelY) * 0.4);
      gathered.push(p);
    }

    const nearestGuide = createNearestParticleLookup(gathered);
    const cellGuides = new Map();
    for (const p of textParticles) {
      if (p.sourceStar) continue;
      // Glyph detail develops locally around arriving stars. It never starts
      // as thousands of equally bright specks scattered over the viewport.
      // A mask cell shares one guide; nearby stroke detail still gets its own
      // timing jitter. This avoids repeating a spatial query for every pixel.
      const cell = p.glyphCell;
      if (!cellGuides.has(cell)) cellGuides.set(cell, nearestGuide(p.relX, p.relY).point);
      const nearest = cellGuides.get(cell);
      const distance = nearest ? (p.relX - nearest.relX) ** 2 + (p.relY - nearest.relY) ** 2 : Infinity;
      const angle = rand() * Math.PI * 2;
      const radius = 5 + rand() * (p.isTitle ? 24 : 10);
      p.startRelX = p.relX + Math.cos(angle) * radius;
      p.startRelY = p.relY + Math.sin(angle) * radius;
      p.travelDuration = 650 + rand() * 400;
      const revealAt = nearest
        ? nearest.delay + nearest.travelDuration * 0.68 + Math.min(Math.sqrt(distance) * 2, 260) + rand() * 240
        : 1900 + rand() * 900;
      p.delay = Math.min(revealAt, INTRO_DURATION - p.travelDuration - 120);
      p.bend = 0;
    }
    for (const p of textParticles) {
      p.travelX = p.relX - p.startRelX;
      p.travelY = p.relY - p.startRelY;
      const length = Math.hypot(p.travelX, p.travelY) || 1;
      p.arcX = -p.travelY / length * p.bend;
      p.arcY = p.travelX / length * p.bend;
    }
    allIntroQueue = textParticles.filter(p => !p.sourceStar).sort((a, b) => a.delay - b.delay);
  }

  function createGlyphLayer(hero, glyph, left, top, width, height, dpr, isTitle, visible) {
    const canvas = document.createElement('canvas');
    canvas.width = glyph.width;
    canvas.height = glyph.height;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'hero-glyph-surface';
    Object.assign(canvas.style, {
      position: 'absolute', pointerEvents: 'none',
      left: `${left}px`, top: `${top}px`,
      width: `${glyph.width / dpr}px`, height: `${glyph.height / dpr}px`
    });
    const ctx = canvas.getContext('2d');
    const mask = document.createElement('canvas');
    const cellSize = isTitle ? 12 : 6;
    const columns = Math.ceil(width / cellSize) + 1;
    const rows = Math.ceil(height / cellSize) + 1;
    mask.width = columns; mask.height = rows;
    const maskCtx = mask.getContext('2d');
    if (!ctx || !maskCtx) return null;
    const image = maskCtx.createImageData(columns, rows);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
    }
    const layer = {
      canvas, ctx, glyph, mask, maskCtx, image, alphaData: image.data, dpr, cellSize, columns, rows,
      particles: [], needsPaint: true, active: true,
      cells: Array.from({ length: columns * rows }, (_, i) => ({
        x: i % columns, y: Math.floor(i / columns),
        count: 0, sum: 0, alpha: visible ? 1 : 0, source: null
      }))
    };
    hero.append(canvas);
    glyphLayers.push(layer);
    return layer;
  }

  function finishGlyphLayer(layer) {
    // Grow neighbouring stroke coverage through empty cells in one grid pass,
    // rather than comparing every empty cell with every occupied cell.
    const queue = [];
    layer.cells.forEach((cell, i) => { cell.source = null; if (cell.count) queue.push(i); });
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head], cell = layer.cells[index];
      const neighbours = [];
      if (cell.x > 0) neighbours.push(index - 1);
      if (cell.x + 1 < layer.columns) neighbours.push(index + 1);
      if (cell.y > 0) neighbours.push(index - layer.columns);
      if (cell.y + 1 < layer.rows) neighbours.push(index + layer.columns);
      for (const next of neighbours) {
        const target = layer.cells[next];
        if (target.count || target.source) continue;
        target.source = cell.count ? cell : cell.source;
        queue.push(next);
      }
    }
  }

  function updateGlyphLayers(heroLeft, heroTop, frameStep) {
    for (const layer of glyphLayers) {
      if (!introStart && !layer.active && !layer.needsPaint) continue;
      let changing = false;
      const downBlend = 1 - Math.exp(-frameStep / 4), upBlend = 1 - Math.exp(-frameStep / 7);
      for (const cell of layer.cells) {
        if (!cell.count) continue;
        const target = clamp(cell.sum / cell.count, 0, 1);
        const blend = target < cell.alpha ? downBlend : upBlend;
        cell.alpha = paused ? target : cell.alpha + (target - cell.alpha) * blend;
        if (Math.abs(target - cell.alpha) < 0.002) cell.alpha = target;
        if (cell.alpha !== target) changing = true;
      }
      let changed = layer.needsPaint;
      for (let i = 0; i < layer.cells.length; i++) {
        const cell = layer.cells[i];
        if (!cell.count) cell.alpha = cell.source?.alpha || 0;
        const alpha = Math.round(cell.alpha * 255);
        const index = i * 4 + 3;
        if (layer.alphaData[index] !== alpha) changed = true;
        layer.alphaData[index] = alpha;
      }

      // Moving particles sample this mask on demand when they are drawn.
      layer.active = changing;

      if (!changed) continue;
      layer.maskCtx.putImageData(layer.image, 0, 0);
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.ctx.drawImage(layer.glyph, 0, 0);
      layer.ctx.globalCompositeOperation = 'destination-in';
      const scale = layer.cellSize * layer.dpr;
      layer.ctx.drawImage(layer.mask, -scale / 2, -scale / 2, layer.columns * scale, layer.rows * scale);
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.needsPaint = false;
    }
  }

  function sampleTextParticles() {
    glyphLayers.forEach(layer => layer.canvas.remove());
    glyphLayers = [];
    activeTextParticles.clear();
    allTextParticles = []; allIntroQueue = []; introQueue = []; introCursor = 0; appliedTextBudget = null;
    particleGrid = createParticleGrid([]);
    sampledTextDensity = quality.text;
    const hero = $('.hero');
    const copy = $('.hero-copy');
    if (!hero || !copy) { textParticles = []; return; }

    const isAlreadySolidified = copy.classList.contains('is-solidified');
    const heroRect = hero.getBoundingClientRect();
    textOriginX = heroRect.left;
    textOriginY = heroRect.top;
    const points = [];

    function sampleTextLine(text, style, targetX, targetCenterY, targetRgb, isTitle = false, fontStyleOverride = null, alignment = 'center') {
      if (!text || text.trim() === '') return;
      const offCanvas = document.createElement('canvas');
      const fontSize = parseFloat(style.fontSize) || 16;
      const fontFamily = style.fontFamily || 'Georgia, serif';
      const fontStyle = fontStyleOverride || style.fontStyle || 'normal';
      const fontWeight = style.fontWeight || '400';
      const letterSpacing = style.letterSpacing || 'normal';

      const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      try { ctx.letterSpacing = letterSpacing; } catch (_) {}

      const metrics = ctx.measureText(text);
      const textWidth = Math.ceil(metrics.width);
      const textHeight = Math.ceil(fontSize * 1.35);
      const pad = 16;
      const w = textWidth + pad * 2;
      const h = textHeight + pad * 2;
      // Full glyphs and their particles share one raster at native screen
      // resolution; the viewport star canvas can keep its lighter buffer.
      const dpr = devicePixelRatio || 1;
      offCanvas.width = Math.ceil(w * dpr);
      offCanvas.height = Math.ceil(h * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      try { ctx.letterSpacing = letterSpacing; } catch (_) {}
      ctx.fillStyle = `rgb(${targetRgb.join(',')})`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, pad, h / 2);

      const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height).data;
      const startX = targetX - textWidth * (alignment === 'right' ? 1 : .5) - pad;
      const startY = targetCenterY - h / 2;
      const glyphLayer = createGlyphLayer(hero, offCanvas, startX, startY, w, h, dpr, isTitle, isAlreadySolidified && !introStart);

      const isMobile = vw < 720;
      const isSmall = fontSize <= 18;
      // Sampling controls the flying particles; the cached glyph keeps the
      // complete strokes once this region has gathered.
      // Moving grains describe the gathering; the full-resolution glyph mask
      // supplies the complete strokes. Dense pixel-by-pixel physics adds cost
      // without making settled text any sharper.
      const lineStep = (isTitle ? (isMobile ? 3.8 : 3.6) : (isSmall ? 1.55 : 2.4)) / Math.sqrt(sampledTextDensity);

      for (let py = 0; py < h; py += lineStep) {
        for (let px = 0; px < w; px += lineStep) {
          const idx = (Math.floor(py * dpr) * offCanvas.width + Math.floor(px * dpr)) * 4;
          const pixelAlpha = imgData[idx + 3] / 255;
          if (pixelAlpha > 0.18) {
            const relX = startX + px;
            const relY = startY + py;

            const vanGoghRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
            const targetRadius = isTitle ? 1.0 : (isSmall ? 0.65 : 0.82);
            const swirlDir = Math.random() < 0.5 ? -1 : 1;

            const particle = {
              relX, relY,
              x: heroRect.left + relX,
              y: heroRect.top + relY,
              vx: 0, vy: 0,
              vanGoghRgb,
              targetColorRgb: targetRgb,
              targetAlpha: pixelAlpha,
              radius: targetRadius,
              swirlDir,
              baseAlpha: pixelAlpha,
              glow: 0,
              detailRank: Math.random(),
              isTitle,
              isSmall,
              settled: isAlreadySolidified,
              dislodged: false,
              dislodgedFactor: 0
            };
            if (glyphLayer) {
              particle.glyphX = px;
              particle.glyphY = py;
              particle.glyphBlend = 0;
              particle.glyphLayer = glyphLayer;
              const gx = px / glyphLayer.cellSize, gy = py / glyphLayer.cellSize;
              const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
              particle.glyphSample = {
                indices: [iy * glyphLayer.columns + ix, iy * glyphLayer.columns + ix + 1,
                  (iy + 1) * glyphLayer.columns + ix, (iy + 1) * glyphLayer.columns + ix + 1].map(index => index * 4 + 3),
                weights: [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
              };
              particle.glyphCell = glyphLayer.cells[Math.round(py / glyphLayer.cellSize) * glyphLayer.columns + Math.round(px / glyphLayer.cellSize)];
              particle.glyphCell.count++;
              particle.coverage = isAlreadySolidified && !introStart ? 1 : 0;
              particle.glyphCell.sum += particle.coverage;
              glyphLayer.particles.push(particle);
            }
            points.push(particle);
          }
        }
      }
    }

    // 1. Kicker: 幻梦星芒 / ASTR — MIRA
    const kickerEl = $('.hero-kicker');
    if (kickerEl) {
      const r = kickerEl.getBoundingClientRect();
      const style = window.getComputedStyle(kickerEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('幻梦星芒 / ASTR — MIRA', style, cx, cy, [205, 192, 168], false);
    }

    // 2. Title: Astrmira (Astr + mira italic)
    const h1El = $('.hero h1');
    if (h1El) {
      const h1Style = window.getComputedStyle(h1El);
      const fontSize = parseFloat(h1Style.fontSize) || 130;
      const fontFamily = h1Style.fontFamily || 'Georgia, serif';

      const mCanvas = document.createElement('canvas');
      const mCtx = mCanvas.getContext('2d');
      mCtx.font = `normal 400 ${fontSize}px ${fontFamily}`;
      try { mCtx.letterSpacing = '-0.075em'; } catch (_) {}
      const wAstr = mCtx.measureText('Astr').width;

      mCtx.font = `italic 400 ${fontSize}px ${fontFamily}`;
      try { mCtx.letterSpacing = '-0.08em'; } catch (_) {}
      const wMira = mCtx.measureText('mira').width;

      const overlap = fontSize * 0.045;
      const totalH1Width = wAstr + wMira - overlap;
      const rH1 = h1El.getBoundingClientRect();
      const h1CenterX = (rH1.left - heroRect.left) + rH1.width / 2;
      const h1CenterY = (rH1.top - heroRect.top) + rH1.height / 2;

      const cxAstr = h1CenterX - totalH1Width / 2 + wAstr / 2;
      const cxMira = h1CenterX - totalH1Width / 2 + wAstr - overlap + wMira / 2;

      sampleTextLine('Astr', h1Style, cxAstr, h1CenterY, [238, 234, 225], true, 'normal');
      sampleTextLine('mira', h1Style, cxMira, h1CenterY, [238, 234, 225], true, 'italic');
    }

    // 3. Subtitle: 于未知处求索，向星穹间开拓。
    const subEl = $('.hero-subtitle');
    if (subEl) {
      const r = subEl.getBoundingClientRect();
      const style = window.getComputedStyle(subEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('于未知处求索，向星穹间开拓。', style, cx, cy, [250, 248, 243], false);
    }

    // 4. English: From first principles to real-world intelligence.
    const engEl = $('.hero-english');
    if (engEl) {
      const r = engEl.getBoundingClientRect();
      const style = window.getComputedStyle(engEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('From first principles to real-world intelligence.', style, cx, cy, [172, 179, 193], false, 'italic');
    }

    // 5. Description: 2 lines
    const descEl = $('.hero-description');
    if (descEl) {
      const r = descEl.getBoundingClientRect();
      const style = window.getComputedStyle(descEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy1 = (r.top - heroRect.top) + r.height * 0.28;
      const cy2 = (r.top - heroRect.top) + r.height * 0.72;
      sampleTextLine('我们研究数据、计算与智能的底层问题，', style, cx, cy1, [165, 174, 189], false);
      sampleTextLine('让严谨的理论，成为可用的系统。', style, cx, cy2, [165, 174, 189], false);
    }

    // The Mira annotation joins the same star gathering and cached glyphs.
    // Measure each line separately to preserve its right edge and typography.
    for (const line of $$('[data-coordinate-line]', hero)) {
      const rect = line.getBoundingClientRect();
      const style = window.getComputedStyle(line);
      const rgb = style.color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [155, 165, 182];
      sampleTextLine(line.textContent.trim(), style, rect.right - heroRect.left,
        rect.top - heroRect.top + rect.height / 2, rgb, false, null, 'right');
    }

    allTextParticles = textParticles = points;
    prepareTextIntro(heroRect);
    applyTextBudget();
  }

  function applyTextBudget() {
    const budget = Math.min(quality.text, sampledTextDensity);
    if (appliedTextBudget === budget) return;
    const initial = appliedTextBudget === null;
    appliedTextBudget = budget;
    const solid = heroCopy?.classList.contains('is-solidified') && !introStart;
    const ratio = budget / sampledTextDensity;
    for (const p of allTextParticles) {
      const enabled = Boolean(p.sourceStar) || p.detailRank <= ratio;
      if (enabled && p.enabled === false) {
        p.settled = Boolean(solid); p.dislodged = false; p.dislodgedFactor = 0;
        p.vx = p.vy = p.glow = 0;
        p.coverage = solid ? 1 : 0;
      }
      p.enabled = enabled;
    }
    textParticles = allTextParticles.filter(p => p.enabled);
    if (!initial) {
      for (const layer of glyphLayers) {
        layer.particles = [];
        for (const cell of layer.cells) { cell.count = 0; cell.sum = 0; }
        layer.active = true;
      }
      for (const p of textParticles) {
        if (!p.glyphCell) continue;
        p.glyphCell.count++;
        p.glyphCell.sum += p.coverage || 0;
        p.glyphLayer.particles.push(p);
      }
    }
    for (const layer of glyphLayers) finishGlyphLayer(layer);
    particleGrid = createParticleGrid(textParticles);
    activeTextParticles = new Set([...activeTextParticles].filter(p => p.enabled));
    for (const p of textParticles) if (p.sourceStar) activeTextParticles.add(p);
    introQueue = allIntroQueue.filter(p => p.enabled);
    introCursor = 0;
  }

  function settleHeroText(left, top) {
    heroCopy?.classList.add('is-solidified', 'is-settled');
    for (const p of textParticles) {
      p.x = left + p.relX; p.y = top + p.relY;
      p.settled = true; p.dislodged = false; p.dislodgedFactor = 0;
      p.vx = p.vy = p.glow = 0;
      setGlyphCoverage(p, 1);
    }
    introCursor = introQueue.length;
    textOriginX = left; textOriginY = top;
  }

  function resizeStarBuffer() {
    if (!starCanvas || !starCtx) return;
    const dpr = Math.min(devicePixelRatio || 1, quality.dpr);
    const bounds = starCanvas.getBoundingClientRect();
    const width = Math.round(bounds.width * dpr), height = Math.round(bounds.height * dpr);
    if (starCanvas.width !== width) starCanvas.width = width;
    if (starCanvas.height !== height) starCanvas.height = height;
    starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particlePainter.resize(bounds.width, bounds.height, dpr);
    trailPaintState = null;
  }

  function applyMotionQuality(next) {
    quality = next;
    document.documentElement.dataset.motionQuality = next.name;
    renderStars = stars.filter(star => star.detailRank < next.stars);
    renderStrands = cometStrands.filter((_, i) => i % next.strandStep === 0);
    applyTextBudget();
    // Changing detail must not rebuild glyphs or restart the comet's history.
    resizeStarBuffer();
  }

  function resizeStars({ render = true } = {}) {
    vw = innerWidth; vh = innerHeight;
    if (starCanvas && starCtx) {
      resizeStarBuffer();
      const rand = seeded(7261);
      // Uneven density, mostly faint stars, and a few brighter nearby stars.
      // Density follows viewport area so small screens retain dark space.
      const count = Math.round(vw * vh / 2400);
      stars = Array.from({ length: count }, (_, index) => {
        let nx, ny;
        do {
          nx = rand(); ny = rand();
        } while (rand() > 0.48 + 0.32 * Math.exp(-Math.pow((ny - 0.68 + nx * 0.36) / 0.24, 2)));
        const ox = nx * vw, oy = ny * vh;
        const depth = rand();
        const r = 0.35 + Math.pow(depth, 3) * 1.05;
        const o = 0.13 + Math.pow(depth, 2) * 0.62;
        const motion = rand();
        const wander = motion < 0.42 ? 0 : motion < 0.88 ? 2 : 7;
        return {
          x: ox, y: oy, origX: ox, origY: oy,
          vx: 0, vy: 0,
          r, o,
          p: rand() * 6.28,
          wanderSpeed: 0.0015 + rand() * 0.003,
          wanderRadiusX: wander * (0.5 + rand()),
          wanderRadiusY: wander * (0.4 + rand() * 0.6),
          glow: 0,
          depth,
          detailRank: (index * .61803398875) % 1,
          isGold: rand() > 0.77,
          gathers: rand() < 0.36,
          textParticle: null
        };
      });
    }
    sampleTextParticles();
    prepareHeroTail();
    applyMotionQuality(quality);
    if (render) { placeStar(true); paintParticlesAndStars(performance.now()); }
  }

  function heroStarAnchor(rect) {
    return {
      x: rect.left + rect.width * (vw < 720 ? .81 : .79),
      y: rect.top + rect.height * (vw < 720 ? .245 : .265)
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
    heroTail = null;
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

      // The old SVG fan is the first segment of the same tail. A feathered
      // moving rear trims it along the curve instead of fading the whole SVG.
      const ns = 'http://www.w3.org/2000/svg';
      const defs = $('defs', sky);
      $$('[data-comet-mask]', defs).forEach(node => node.remove());
      const gradient = document.createElementNS(ns, 'linearGradient');
      gradient.id = 'comet-tail-feather';
      gradient.dataset.cometMask = '';
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
      for (const [offset, opacity] of [[0, 0], [1, 1]]) {
        const stop = document.createElementNS(ns, 'stop');
        stop.setAttribute('offset', String(offset));
        stop.setAttribute('stop-color', 'white');
        stop.setAttribute('stop-opacity', String(opacity));
        gradient.append(stop);
      }
      const mask = document.createElementNS(ns, 'mask');
      mask.id = 'comet-tail-mask';
      mask.dataset.cometMask = '';
      mask.setAttribute('maskUnits', 'userSpaceOnUse');
      const bounds = group.getBBox();
      const fill = document.createElementNS(ns, 'rect');
      for (const [name, value] of Object.entries({ x: bounds.x - 2, y: bounds.y - 2, width: bounds.width + 4, height: bounds.height + 4 })) {
        mask.setAttribute(name, String(value));
        fill.setAttribute(name, String(value));
      }
      fill.setAttribute('fill', 'url(#comet-tail-feather)');
      mask.append(fill); defs.append(gradient, mask);
      group.setAttribute('mask', 'url(#comet-tail-mask)');
      heroTail = { group, route, length, gradient, state: null };
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
    renderStrands = cometStrands.filter((_, i) => i % quality.strandStep === 0);
    cometPath = createCometPath(opening, { width: document.documentElement.clientWidth, height: vh, heroBottom: rect ? rect.bottom + window.scrollY : 0 });
    cometDockElement = $('[data-comet-dock]');
    cometDockSurface = cometDockElement?.closest('.origin-art');
    refreshCometDock();
    cometTrail = createCometTrail(Math.hypot(vw, vh) * .82);
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
    return true;
  }

  function observeCometDock() {
    cometDockObserver?.disconnect();
    if (!cometDockElement) return;
    // Remeasure only when content or the illustration changes size, not on
    // every animation frame. This also covers fonts and responsive reflow.
    cometDockObserver = new ResizeObserver(() => {
      if (!refreshCometDock()) return;
      cometParam = cometUpdatedAt = null;
      if (paused) { placeStar(true); paintParticlesAndStars(performance.now()); }
    });
    cometDockObserver.observe(main);
    cometDockObserver.observe(cometDockElement.ownerSVGElement);
  }

  function revealHeroTail(points, feather, rearDistance = cometTrail.rear, segmentOpacity = 1) {
    if (!heroTail) return;
    const opening = points.filter(p => p.param <= cometPath.heroLength);
    if (opening.length < 2) { heroTail.group.setAttribute('opacity', '0'); heroTail.state = null; return; }
    const first = opening[0], last = opening[opening.length - 1];
    const rear = cometPoint(cometPath, first.param).u;
    const front = cometPoint(cometPath, last.param).u;
    const fadeEnd = opening.find(p => p.distance >= rearDistance + feather) || last;
    const opacity = smoothstep((last.distance - rearDistance) / feather) * segmentOpacity;
    const state = `${rear}:${front}:${fadeEnd.param}:${opacity}`;
    if (state === heroTail.state) return;
    const from = heroTail.route.getPointAtLength(heroTail.length * rear);
    const to = heroTail.route.getPointAtLength(heroTail.length * cometPoint(cometPath, fadeEnd.param).u);
    heroTail.gradient.setAttribute('x1', String(from.x));
    heroTail.gradient.setAttribute('x2', String(Math.max(from.x + .001, to.x)));
    heroTail.group.setAttribute('stroke-dasharray', `${front - rear} 1`);
    heroTail.group.setAttribute('stroke-dashoffset', String(-rear));
    heroTail.group.setAttribute('opacity', String(opacity));
    heroTail.state = state;
  }

  function updateStarTarget(immediate = false, now = performance.now()) {
    if (!cometPath) return;
    const hero = heroElement;
    frameHeroRect = hero?.getBoundingClientRect() || null;
    const previous = cometParam;
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
    if (previous === null || immediate) {
      cometTrail = createCometTrail(Math.hypot(vw, vh) * .82);
      const from = cometWorld.docking === 1 ? cometParam : Math.max(0, cometParam - cometTrail.maxLength);
      recordCometMotion(cometTrail, cometPath, from, cometParam, now);
    } else if (recordCometMotion(cometTrail, cometPath, previous, cometParam, now)) {
      for (const spark of stardustSparks) if (spark.world) spark.turnFadeAt ??= now;
    }
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
    heroDeparture = null;
    exitWheelHeld = false;
  }

  function beginHeroDeparture(hero) {
    const from = window.scrollY;
    const distance = hero.getBoundingClientRect().bottom;
    // Yield the opening to the visitor's navigation intent. The glyph masks
    // still blend into their settled state while the whole hero fades away.
    introStart = 0;
    mouseX = mouseY = lastMouseX = lastMouseY = -9999;
    mouseVx = mouseVy = 0;
    if (paused || reduced.matches) {
      window.scrollTo({ top: from + distance, behavior: 'instant' });
      placeStar(true);
      paintParticlesAndStars(performance.now());
      return;
    }
    const duration = 920 * Math.min(1, Math.sqrt(distance / Math.max(innerHeight, 1)));
    heroDeparture = { hero, from, destination: from + distance, cometFrom: cometParam, started: performance.now(), duration, progress: 0 };
  }

  function advanceHeroDeparture(now) {
    const departure = heroDeparture;
    if (!departure) return false;
    if (!departure.hero.isConnected) { cancelHeroDeparture(); return false; }
    const t = clamp((now - departure.started) / departure.duration, 0, 1);
    // Scroll before painting in the same frame: the DOM tail and fixed canvas
    // must use the same scroll position, including frames under rendering load.
    departure.progress = t * t * t * (t * (t * 6 - 15) + 10);
    const end = departure.hero.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: departure.from + (end - departure.from) * departure.progress, behavior: 'instant' });
    return t === 1;
  }

  function onHeroWheel(event) {
    if (event.defaultPrevented) return;
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
    starX = targetX;
    starY = targetY;
    if (companion) {
      const pose = `translate3d(${starX.toFixed(2)}px, ${starY.toFixed(2)}px, 0) translate(-50%, -50%)`;
      if (pose !== companionPose) {
        companion.style.left = companion.style.top = '0';
        companion.style.transform = pose;
        companionPose = pose;
      }
    }
    if (immediate) {
      prevStarX = starX; prevStarY = starY;
      prevCometX = cometWorld.x; prevCometY = cometWorld.y;
    }
  }

  function paintCometTrail(now) {
    fadeCometTrail(cometTrail, now, !paused && !introStart && cometHasDeparted);
    const segments = visibleCometTrailSegments(cometTrail).map(segment => ({
      ...segment,
      feather: Math.max(1, Math.min(cometTrail.maxLength * .3, (segment.distance - segment.rear) * .65))
    }));
    const opening = segments.find(segment => segment.points[0].param <= cometPath.heroLength);
    if (opening) revealHeroTail(opening.points, opening.feather, opening.rear, opening.opacity);
    else revealHeroTail([], 1);
    if (particlePainter.accelerated) {
      const drawable = segments.filter(segment => segment.points.some(point => point.param > cometPath.heroLength));
      const state = drawable.length ? `${window.scrollX}:${window.scrollY}:${cometTrail.rear}:${cometTrail.distance}:${renderStrands.length}:${drawable.map(segment => segment.opacity).join(',')}` : '';
      if (state === trailPaintState) return;
      starCtx.clearRect(0, 0, vw, vh);
      trailPaintState = state;
    } else trailPaintState = null;
    for (const segment of segments) paintCometSegment(segment);
  }

  function paintCometSegment({ points, distance, rear, opacity, feather }) {
    const first = points.findIndex(point => point.param > cometPath.heroLength);
    if (first < 0) return;
    const nodes = points.slice(Math.max(0, first - 1)).map((point, i, list) => {
      const a = list[Math.max(0, i - 1)], b = list[Math.min(list.length - 1, i + 1)];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return {
        x: point.x - window.scrollX, y: point.y - window.scrollY,
        nx: -(b.y - a.y) / length, ny: (b.x - a.x) / length,
        // Every opening filament ends at this same point. Ease their width out
        // from it instead of starting the continuation with an offset fan.
        spread: Math.pow((distance - point.distance) / cometTrail.maxLength, 1.2)
          * smoothstep((point.param - cometPath.heroLength) / Math.min(180, cometTrail.maxLength * .2)),
        distance: point.distance
      };
    });
    // Only the feather needs short gradient spans. The rest of each fine
    // filament is one path, matching the opening fan without a bright core.
    const chunks = [];
    let chunk = [nodes[0]];
    const step = feather / 8, fadeEnd = rear + feather;
    let boundary = rear + (Math.floor((nodes[0].distance - rear) / step) + 1) * step;
    for (let i = 1; i < nodes.length; i++) {
      let a = nodes[i - 1];
      const b = nodes[i];
      while (boundary <= fadeEnd && boundary <= b.distance) {
        const t = (boundary - a.distance) / (b.distance - a.distance);
        const split = {};
        for (const key of ['x', 'y', 'nx', 'ny', 'spread']) split[key] = a[key] + (b[key] - a[key]) * t;
        split.distance = boundary;
        chunk.push(split); chunks.push(chunk); chunk = [split];
        a = split; boundary += step;
      }
      if (b.distance > a.distance) chunk.push(b);
    }
    if (chunk.length > 1) chunks.push(chunk);
    starCtx.save();
    starCtx.lineCap = 'round';
    starCtx.lineJoin = 'round';
    for (const part of chunks) {
      const a = part[0], b = part[part.length - 1];
      const fromAlpha = smoothstep((a.distance - rear) / feather);
      const toAlpha = smoothstep((b.distance - rear) / feather);
      const gradients = new Map();
      for (const strand of renderStrands) {
        let color = strand.color;
        if (fromAlpha < 1) {
          if (!gradients.has(color)) {
            const gradient = starCtx.createLinearGradient(a.x, a.y, b.x, b.y);
            const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
            gradient.addColorStop(0, `rgba(${rgb},${fromAlpha})`);
            gradient.addColorStop(1, `rgba(${rgb},${toAlpha})`);
            gradients.set(color, gradient);
          }
          color = gradients.get(color);
        }
        starCtx.beginPath();
        part.forEach((point, i) => {
          const x = point.x + point.nx * strand.offset * point.spread;
          const y = point.y + point.ny * strand.offset * point.spread;
          if (i) starCtx.lineTo(x, y); else starCtx.moveTo(x, y);
        });
        starCtx.lineWidth = strand.width;
        starCtx.globalAlpha = strand.alpha * Math.sqrt(quality.strandStep) * opacity;
        starCtx.strokeStyle = color;
        starCtx.stroke();
      }
    }
    starCtx.restore();
  }

  function paintParticlesAndStars(now) {
    if (!starCtx) return;
    const frameStep = lastPaint ? clamp((now - lastPaint) / (1000 / 60), 0, 3) : 1;
    lastPaint = now;
    if (!particlePainter.accelerated) starCtx.clearRect(0, 0, vw, vh);

    const starVx = starX - prevStarX;
    const starVy = starY - prevStarY;
    prevStarX = starX; prevStarY = starY;
    const cometVx = cometWorld.x - prevCometX, cometVy = cometWorld.y - prevCometY;
    const cometMovingSpeed = Math.hypot(cometVx, cometVy);
    prevCometX = cometWorld.x; prevCometY = cometWorld.y;

    const hero = heroElement;
    const heroRect = frameHeroRect;
    const heroLeft = heroRect ? heroRect.left : 0;
    const heroTop = heroRect ? heroRect.top : 0;
    const heroVisible = heroRect && heroRect.bottom > 0 && heroRect.top < vh && heroContentOpacity > .001;

    // The canvas is fixed to the viewport; carry text with its hero on scroll,
    // including particles currently displaced by the pointer or intro.
    const textShiftX = heroLeft - textOriginX;
    const textShiftY = heroTop - textOriginY;
    if (heroVisible) {
      if (textShiftX || textShiftY) for (const p of activeTextParticles) {
        p.x += textShiftX;
        p.y += textShiftY;
      }
      textOriginX = heroLeft;
      textOriginY = heroTop;
    }

    const copy = heroCopy;
    const introElapsed = introStart ? now - introStart : INTRO_DURATION;
    if (introStart) {
      if (introElapsed > 3500) copy?.classList.add('is-settled');
      if (introElapsed >= INTRO_DURATION) {
        introStart = 0;
        settleHeroText(heroLeft, heroTop);
      }
    } else {
      if (copy && !copy.classList.contains('is-solidified')) {
        settleHeroText(heroLeft, heroTop);
      }
    }
    const isSolidified = copy ? copy.classList.contains('is-solidified') : false;

    if (!isSolidified) {
      while (introCursor < introQueue.length && introQueue[introCursor].delay <= introElapsed) {
        activeTextParticles.add(introQueue[introCursor++]);
      }
    }

    const pointerOnHero = heroVisible && !paused && !heroDeparture && mouseX > -1000;
    const workingText = !heroVisible ? [] : !isSolidified ? activeTextParticles
      : pointerOnHero ? particleGrid.near(mouseX - heroLeft, mouseY - heroTop, 82, activeTextParticles)
        : activeTextParticles;

    // 1. Persistent sky: still stars, slow drift, and occasional local motion.
    const starMovingSpeed = Math.hypot(starVx, starVy);
    for (const s of renderStars) {
      if (!paused) {
        s.p += s.wanderSpeed * frameStep;
        const targetWanderX = s.origX + (Math.cos(s.p) + Math.sin(s.p * 1.73) * 0.3) * s.wanderRadiusX;
        const targetWanderY = s.origY + Math.sin(s.p * 0.82 + s.depth) * s.wanderRadiusY;
        s.vx += (targetWanderX - s.x) * 0.008 * frameStep;
        s.vy += (targetWanderY - s.y) * 0.008 * frameStep;
      }

      // Only nearby stars feel the passing companion, with no continuous
      // repulsion once it rests beside the title.
      const sDx = s.x - starX, sDy = s.y - starY;
      const sDist = Math.hypot(sDx, sDy);
      const miraRepelDist = 135;
      if (!paused && starMovingSpeed > 0.15 && sDist < miraRepelDist && sDist > 1) {
        const f = Math.pow(1 - sDist / miraRepelDist, 1.6);
        const push = f * Math.min(starMovingSpeed, 8) * 0.025;
        s.vx += ((sDx - sDy * 0.3) / sDist) * push * frameStep;
        s.vy += ((sDy + sDx * 0.3) / sDist) * push * frameStep;
        s.glow = Math.min(0.35, s.glow + f * 0.025 * frameStep);
      }

      // Cursor perturbation
      if (!paused && mouseX > -1000) {
        const mDx = s.x - mouseX, mDy = s.y - mouseY;
        const mDist = Math.hypot(mDx, mDy);
        if (mDist < 120 && mDist > 1) {
          const mf = Math.pow(1 - mDist / 120, 1.5);
          s.vx += ((mDx / mDist) * mf * 0.12 + mouseVx * mf * 0.008) * frameStep;
          s.vy += ((mDy / mDist) * mf * 0.12 + mouseVy * mf * 0.008) * frameStep;
          s.glow = Math.min(0.35, s.glow + mf * 0.015 * frameStep);
        }
      }

      if (!paused) {
        const damping = Math.pow(0.9, frameStep);
        s.vx *= damping; s.vy *= damping;
        s.x += s.vx * frameStep; s.y += s.vy * frameStep;
        s.glow *= Math.pow(0.96, frameStep);
      }

      // Recruited stars are drawn once, by their moving glyph particle.
      if (hero && s.textParticle) continue;
      const twinkle = paused ? 1 : (0.86 + 0.14 * Math.sin(now / (2600 + s.depth * 3100) + s.p)) + s.glow * 0.3;
      const alpha = clamp(s.o * twinkle, 0, 1);
      particlePainter.dot(s.x + pointerX * (.05 + s.depth * .1), s.y + pointerY * (.05 + s.depth * .1), s.r * (1 + s.glow * .35), s.isGold ? 238 : 176, s.isGold ? 215 : 202, s.isGold ? 172 : 230, alpha);

      if (s.glow > 0.35 || (s.depth > 0.90 && alpha > 0.6)) {
        particlePainter.dot(s.x, s.y, s.r * .45, 255, 252, 240, clamp(alpha * .95, 0, 1));
      }
    }

    paintCometTrail(now);

    // Dust shares the trail's document coordinates, so scrolling cannot drag
    // already emitted particles along with the viewport.
    if (!paused && cometMovingSpeed > 0.6) {
      const travelling = !introStart && cometHasDeparted;
      cometSparkBudget += Math.min(3, Math.floor(cometMovingSpeed / Math.max(frameStep, .01) * .55) + 1) * quality.dust * frameStep;
      const sparkCount = Math.floor(cometSparkBudget);
      cometSparkBudget -= sparkCount;
      for (let k = 0; k < sparkCount; k++) {
        const spAngle = Math.random() * Math.PI * 2;
        const spDist = Math.random() * (travelling ? 5 : 22);
        const alongWake = travelling ? (k + Math.random()) / sparkCount : 0;
        stardustSparks.push({
          x: cometWorld.x - cometVx * alongWake + Math.cos(spAngle) * spDist,
          y: cometWorld.y - cometVy * alongWake + Math.sin(spAngle) * spDist,
          world: true,
          vx: -cometVx * (travelling ? .06 : .25) + (Math.random() - 0.5) * (travelling ? .8 : 2.2),
          vy: -cometVy * (travelling ? .06 : .25) + (Math.random() - 0.5) * (travelling ? .8 : 2.2),
          size: travelling ? .45 + Math.random() * .8 : .8 + Math.random() * 1.3,
          life: 1.0,
          decay: travelling ? .006 + Math.random() * .006 : .022 + Math.random() * .022,
          rgb: VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)]
        });
      }
    }

    // 2. Staggered gathering, then direct interaction with the settled text.
    let dislodgedCount = 0;

    if (heroVisible) {
      for (const p of workingText) {
        const homeX = heroLeft + p.relX;
        const homeY = heroTop + p.relY;
        if (p.settled || paused || (isSolidified && !p.dislodged)) {
          p.x = homeX; p.y = homeY;
          if (isSolidified) {
            p.settled = true; p.dislodged = false; p.dislodgedFactor = 0;
            p.vx = p.vy = p.glow = 0;
          }
        }
        const toHomeX = homeX - p.x;
        const toHomeY = homeY - p.y;
        const distToHome = Math.hypot(toHomeX, toHomeY);

        if (!isSolidified) {
          const progress = clamp((introElapsed - p.delay) / p.travelDuration, 0, 1);
          const u = smoothstep(progress);
          p.introProgress = progress;
          const fromX = heroLeft + p.startRelX;
          const fromY = heroTop + p.startRelY;
          const arc = p.bend ? Math.sin(Math.PI * u) : 0;
          const drift = p.sourceStar ? Math.sin(introElapsed / 1500 + p.sourceStar.p) * 1.2 * (1 - u) : 0;
          p.x = fromX + p.travelX * u + p.arcX * arc + drift;
          p.y = fromY + p.travelY * u + p.arcY * arc + drift * 0.5;
          p.vx = 0; p.vy = 0;
          p.glow = 0;
          p.settled = progress === 1;
        } else {
          // Solidified state: direct particle interaction and local disintegration
          let mDist = 9999;
          if (pointerOnHero) {
            const mDx = p.x - mouseX;
            const mDy = p.y - mouseY;
            mDist = Math.hypot(mDx, mDy);
            const repelRadius = 82;
            if (mDist < repelRadius && mDist > 0.5) {
              const mF = 1 - mDist / repelRadius;
              p.dislodged = true;
              if (p.glyphLayer) p.glyphLayer.active = true;
              p.settled = false;
              p.dislodgedFactor = Math.min(1.0, p.dislodgedFactor + 0.32);
              const push = mF * 11.5 + Math.hypot(mouseVx, mouseVy) * 0.22;
              const swirl = mF * 7.0 * p.swirlDir;
              p.vx += (mDx / mDist) * push + (-mDy / mDist) * swirl + mouseVx * 0.24;
              p.vy += (mDy / mDist) * push + (mDx / mDist) * swirl + mouseVy * 0.24;
              p.glow = Math.min(1.0, p.glow + mF * 1.2);
            }
          }

          if (!p.settled) {
            const speed = Math.hypot(p.vx, p.vy);
            // Settle cleanly into exact pixel coordinate
            if (distToHome < 1.4 && (speed < 0.7 || distToHome < 0.7) && mDist > 84) {
              p.x = homeX; p.y = homeY;
              p.vx = 0; p.vy = 0;
              p.settled = true;
              p.dislodged = false;
              p.dislodgedFactor = 0;
              p.glow = 0;
            } else {
              // Cosmic gravity pulling back into letterform
              const pull = Math.min(distToHome * 0.098, 9.2);
              const swirlDistFactor = clamp((distToHome - 8) / 28, 0, 1);
              const swirl = Math.min(distToHome * 0.024, 2.5) * p.swirlDir * swirlDistFactor;
              if (distToHome > 0.3) {
                p.vx += (toHomeX / distToHome) * pull + (-toHomeY / distToHome) * swirl;
                p.vy += (toHomeY / distToHome) * pull + (toHomeX / distToHome) * swirl;
              }
              const damp = distToHome < 12 ? 0.70 : 0.82;
              p.vx *= damp; p.vy *= damp;
              p.x += p.vx; p.y += p.vy;
              p.glow *= 0.91;
              if (mDist > 84) {
                p.dislodgedFactor = Math.max(0, p.dislodgedFactor - 0.04);
              }
            }
          }
        }

        const arrival = introStart ? smoothstep((p.introProgress - .72) / .28) : 1;
        const glyphDistance = p.settled ? 0 : Math.hypot(p.x - homeX, p.y - homeY);
        setGlyphCoverage(p, arrival * (1 - smoothstep((glyphDistance - 1) / 9)));
        if (!p.settled) {
          dislodgedCount++;
          activeTextParticles.add(p);
        }
      }
    }

    if (heroVisible) updateGlyphLayers(heroLeft, heroTop, frameStep);

    // 3. A sparse travelling star becomes a glyph; nearby detail fades in only
    // as it arrives, keeping empty space clear during the opening.
    if (heroVisible) {
      for (const p of workingText) {
        p.glyphBlend = sampleGlyphCoverage(p);
        if (p.settled && p.glyphBlend >= .998) {
          activeTextParticles.delete(p);
          continue;
        }
        const reveal = introStart ? smoothstep(p.introProgress) : 1;
        const arrival = introStart ? smoothstep((p.introProgress - 0.55) / 0.45) : 1;
        let alpha = p.targetAlpha;
        if (introStart) {
          if (p.sourceStar) {
            const s = p.sourceStar;
            const twinkle = 0.86 + 0.14 * Math.sin(now / (2600 + s.depth * 3100) + s.p);
            alpha = s.o * twinkle * (1 - arrival) + p.targetAlpha * arrival;
          } else {
            alpha *= reveal;
          }
        } else if (p.dislodged) {
          alpha = clamp(alpha + p.glow * 0.35, 0, 1);
        }
        if (p.glyphCell) alpha *= 1 - p.glyphBlend;
        alpha *= heroContentOpacity;
        if (alpha <= 0.01) continue;

        let red, green, blue;
        if (isSolidified) {
          const f = p.dislodgedFactor;
          red = p.targetColorRgb[0] + (p.vanGoghRgb[0] - p.targetColorRgb[0]) * f;
          green = p.targetColorRgb[1] + (p.vanGoghRgb[1] - p.targetColorRgb[1]) * f;
          blue = p.targetColorRgb[2] + (p.vanGoghRgb[2] - p.targetColorRgb[2]) * f;
        } else {
          const f = 1 - arrival;
          const starRgb = p.sourceStar?.isGold ? [238, 215, 172] : [176, 202, 230];
          red = p.targetColorRgb[0] + (starRgb[0] - p.targetColorRgb[0]) * f;
          green = p.targetColorRgb[1] + (starRgb[1] - p.targetColorRgb[1]) * f;
          blue = p.targetColorRgb[2] + (starRgb[2] - p.targetColorRgb[2]) * f;
        }

        // Settled small text retains its dense glyph sampling.
        if (p.settled && p.isSmall) {
          // High-definition subpixel rasterization: 100% crisp typography
          particlePainter.dot(p.x, p.y, -.55, red, green, blue, alpha);
        } else {
          const startRadius = p.sourceStar ? p.sourceStar.r : p.radius * 0.65;
          const renderRadius = (introStart ? startRadius + (p.radius - startRadius) * arrival : p.radius) * (1 + p.glow * 0.35);

          particlePainter.dot(p.x, p.y, renderRadius, red, green, blue, alpha);

          if (p.glow > 0.25 || p.vx * p.vx + p.vy * p.vy > 1.44) {
            particlePainter.dot(p.x, p.y, Math.max(.4, renderRadius * .45), 255, 252, 242, alpha * .85);
          }
        }
      }
    }

    // 4. Stardust emission & rendering on disintegration
    if (!paused && isSolidified && dislodgedCount > 0) {
      const mSpeed = Math.hypot(mouseVx, mouseVy);
      if (mSpeed > 0.6) {
        textSparkBudget += Math.min(2, Math.floor(mSpeed * .5) + 1) * quality.dust * frameStep;
        const count = Math.floor(textSparkBudget);
        textSparkBudget -= count;
        for (let k = 0; k < count; k++) {
          const spA = Math.random() * Math.PI * 2;
          const spD = Math.random() * 55;
          const spRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
          stardustSparks.push({
            x: mouseX + Math.cos(spA) * spD,
            y: mouseY + Math.sin(spA) * spD,
            vx: mouseVx * 0.2 + (Math.random() - 0.5) * 2.5 + (-Math.sin(spA) * 2),
            vy: mouseVy * 0.2 + (Math.random() - 0.5) * 2.5 + (Math.cos(spA) * 2),
            size: 0.6 + Math.random() * 0.8,
            life: 1.0,
            decay: 0.035 + Math.random() * 0.025,
            rgb: spRgb
          });
        }
      }
    }

    if (stardustSparks.length > 0) {
      let kept = 0;
      for (const sp of stardustSparks) {
        if (!paused) {
          sp.x += sp.vx * frameStep; sp.y += sp.vy * frameStep;
          const damping = Math.pow(.91, frameStep);
          sp.vx *= damping; sp.vy *= damping;
          sp.life -= sp.decay * frameStep;
        }
        const turnOpacity = sp.turnFadeAt === undefined ? 1 : cometTurnOpacity(sp.turnFadeAt, now);
        if (sp.life <= 0 || turnOpacity <= 0) continue;
        stardustSparks[kept++] = sp;
        const x = sp.x - (sp.world ? window.scrollX : 0), y = sp.y - (sp.world ? window.scrollY : 0);
        if (x < -3 || x > vw + 3 || y < -3 || y > vh + 3) continue;
        particlePainter.dot(x, y, sp.size * (.5 + sp.life * .5), sp.rgb[0], sp.rgb[1], sp.rgb[2], clamp(sp.life * .9, 0, 1) * turnOpacity);
      }
      stardustSparks.length = kept;
    }
    particlePainter.flush();
    sceneBusy = Boolean(introStart || heroDeparture || cometMovingSpeed > .6 || (heroVisible && activeTextParticles.size));
    if (!paused) {
      mouseVx *= Math.pow(0.86, frameStep);
      mouseVy *= Math.pow(0.86, frameStep);
    }
  }

  function startIntro() {
    if (paused || reduced.matches || !$('.hero')) return;
    const copy = $('.hero-copy');
    if (copy) {
      copy.classList.remove('is-settled');
      copy.classList.remove('is-solidified');
    }
    const textStage = $('.hero-text-stage');
    if (textStage) {
      textStage.classList.remove('is-dissolving');
      textStage.style.removeProperty('--stage-opacity');
      textStage.style.removeProperty('--mr');
      textStage.style.removeProperty('--mx');
      textStage.style.removeProperty('--my');
    }
    maskRadius = 0; targetMaskRadius = 0;
    stardustSparks = [];
    activeTextParticles = new Set(textParticles.filter(p => p.sourceStar));
    introCursor = 0;
    cometParam = 0;
    cometUpdatedAt = null;
    cometHasDeparted = false;
    cometTrail = createCometTrail(Math.hypot(vw, vh) * .82);
    for (const layer of glyphLayers) {
      layer.active = true;
      layer.cells.forEach(cell => { cell.alpha = 0; cell.sum = 0; });
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.needsPaint = true;
    }
    const hero = $('.hero');
    const heroRect = hero ? hero.getBoundingClientRect() : { left: 0, top: 0 };
    textOriginX = heroRect.left;
    textOriginY = heroRect.top;
    if (textParticles.length > 0) {
      textParticles.forEach(p => {
        p.coverage = 0;
        p.settled = false;
        p.dislodged = false;
        p.dislodgedFactor = 0;
        p.x = heroRect.left + p.startRelX;
        p.y = heroRect.top + p.startRelY;
        p.introProgress = 0;
        p.vx = 0; p.vy = 0;
        p.glow = 0;
      });
    }
    introStart = performance.now();
    placeStar(true, introStart);
    prevStarX = starX;
    prevStarY = starY;
  }

  function tick(now) {
    raf = 0;
    const frameTime = nextFrameTime(lastFrame, now);
    let renderCost = null;
    if (frameTime !== null) {
      lastFrame = frameTime;
      if (pendingQuality) { applyMotionQuality(pendingQuality); pendingQuality = null; }
      const started = performance.now();
      const departed = advanceHeroDeparture(now);
      placeStar(false, now);
      paintParticlesAndStars(now);
      if (departed) heroDeparture = null;
      renderCost = performance.now() - started;
    }
    pendingQuality = motionQuality.sample(now, renderCost, sceneBusy, Boolean(introStart)) || pendingQuality;
    if (!paused) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    motionQuality.reset();
    lastFrame = lastPaint = 0;
    if (!document.hidden) {
      if (paused) { placeStar(true); paintParticlesAndStars(performance.now()); }
      else raf = requestAnimationFrame(tick);
    }
  }

  function updateMotionButtons() {
    document.documentElement.classList.toggle('is-paused', paused);
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.disabled = reduced.matches;
    });
    $$('[data-motion-text]').forEach(el => el.textContent = reduced.matches ? '已减少动态' : paused ? '启用动效' : '静止动效');
    $$('[data-replay]').forEach(button => button.disabled = reduced.matches);
  }

  window.addEventListener('wheel', onHeroWheel, { passive: false });
  window.addEventListener('pointerdown', cancelHeroDeparture, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key)) cancelHeroDeparture();
  });

  window.addEventListener('pointermove', e => {
    if (!finePointer.matches || paused) return;
    pointerX = (e.clientX / vw - .5) * 16;
    pointerY = (e.clientY / vh - .5) * 12;
    if (lastMouseX > -1000) {
      mouseVx = (e.clientX - lastMouseX) * 0.4;
      mouseVy = (e.clientY - lastMouseY) * 0.4;
    }
    mouseX = e.clientX; mouseY = e.clientY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    mouseX = mouseY = lastMouseX = lastMouseY = -9999;
    mouseVx = mouseVy = 0;
    pointerX = pointerY = 0;
    targetMaskRadius = 0;
  });

  window.addEventListener('scroll', () => {
    if (paused) {
      placeStar(true);
      paintParticlesAndStars(performance.now());
    }
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    cancelHeroDeparture();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeStars, 100);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelHeroDeparture();
      cometUpdatedAt = null;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      introStart = 0;
      motionQuality.reset();
    } else startLoop();
  });

  reduced.addEventListener('change', () => {
    const destination = heroDeparture ? heroDeparture.hero.getBoundingClientRect().bottom + window.scrollY : null;
    cancelHeroDeparture();
    if (reduced.matches && destination !== null) window.scrollTo({ top: destination, behavior: 'instant' });
    paused = reduced.matches;
    introStart = 0;
    updateMotionButtons(); startLoop();
  });

  if (standalone && location.hash.startsWith('#/') && location.hash.length > 2) go(location.hash.slice(2), false);
  else initPage();
  startIntro();
  startLoop();

  if (document.fonts?.status === 'loading') {
    document.fonts.ready.then(() => {
      sampleTextParticles();
      if (paused) paintParticlesAndStars(performance.now());
    });
  }
})();
