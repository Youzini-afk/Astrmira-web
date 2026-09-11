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
  const ui = getUi();
  const standalone = document.body.dataset.mode === 'standalone';
  const main = $('#main');
  let filterResearch = 'all';
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
    filterResearch = 'all';
    $$('[data-copy-contact]').forEach(button => button.hidden = false);
    const route = main?.dataset.route || 'home';
    $$('.site-nav [data-route]').forEach(a => {
      if (route === a.dataset.route || route.startsWith(a.dataset.route + '/')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();
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
    if (t.matches('[data-research-search]')) filterResearchItems();
  });

  if (standalone && location.hash.startsWith('#/') && location.hash.length > 2) go(location.hash.slice(2), false);
  else initPage();
})();
