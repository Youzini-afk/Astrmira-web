import { mountArticleTocs } from './article-toc.js';
import { mountPaperCarousels } from './paper-carousel.js';
import { mountPaperBooks } from './paper-books.js';
import { createMotionController } from './motion-controller.js';
import { mountSiteMenu } from './site-menu.js';
import { getUi, countLabel } from './ui.js';
import { copyContactEmail } from './contact.js';

/* Astrmira — progressive enhancement. No network requests, no external runtime. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ui = getUi();
  const standalone = document.body.dataset.mode === 'standalone';
  const main = $('#main');
  let filterResearch = 'all';
  let queryY = 154;
  let agentStage = 0;
  const motion = createMotionController(main);
  const closeMenu = mountSiteMenu();
  let disposeArticleTocs = () => {};
  let disposePaperCarousels = () => {};
  let disposePaperBooks = () => {};

  function initPage({ focus = false } = {}) {
    disposeArticleTocs();
    disposeArticleTocs = mountArticleTocs(main, () => motion.paused);
    disposePaperCarousels();
    disposePaperCarousels = mountPaperCarousels(main, () => motion.paused);
    disposePaperBooks();
    disposePaperBooks = mountPaperBooks(main);
    filterResearch = 'all'; queryY = 154; agentStage = 0;
    $$('[data-copy-contact]').forEach(button => button.hidden = false);
    const route = main?.dataset.route || 'home';
    $$('.site-nav [data-route]').forEach(a => {
      if (route === a.dataset.route || route.startsWith(a.dataset.route + '/')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();
    drawQuant(3); drawAgent();
    if (focus) main?.focus({ preventScroll: true });
    motion.refresh();
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
    const output = $('[data-project-count]'); if (output) output.textContent = countLabel('projects', count);
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
    const output = $('[data-research-count]'); if (output) output.textContent = countLabel('research', count);
  }

  // One delegated listener remains valid after single-file preview navigation.
  document.addEventListener('click', async e => {
    const target = e.target instanceof Element ? e.target : null; if (!target) return;
    const routeLink = target.closest('a[data-route]');
    if (routeLink && standalone && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault(); go(routeLink.dataset.route); return;
    }
    if (target.closest('[data-back-top]')) { e.preventDefault(); window.scrollTo({top:0,behavior:motion.paused ? 'instant' : 'smooth'}); main?.focus({preventScroll:true}); return; }
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
    if (target.closest('[data-replay]')) { motion.replay(); return; }
    if (target.closest('[data-motion-toggle]')) { motion.toggle(); return; }
    const copyEmail = target.closest('[data-copy-contact]');
    if (copyEmail) await copyContactEmail(copyEmail, ui.contact);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.matches('[data-query-range]')) moveQuery(Number(t.value),queryY);
    if (t.matches('[data-bits-range]')) drawQuant(Number(t.value));
    if (t.matches('[data-research-search]')) filterResearchItems();
  });
  document.addEventListener('keydown', e => {
    if (!e.target.matches?.('[data-lab-tab]')) return;
    const keys=['vector','quant','agent']; const i=keys.indexOf(e.target.dataset.labTab);
    const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;
    if(next>=0){e.preventDefault();activateTab(keys[next],true);}
  });

  if (standalone && location.hash.startsWith('#/') && location.hash.length > 2) go(location.hash.slice(2), false);
  else initPage();
})();
