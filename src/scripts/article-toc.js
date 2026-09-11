import { getUi } from './ui.js';

export function headingSlug(text) {
  return text.normalize('NFKC').toLowerCase().trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '') || 'heading';
}

export function activeHeadingAt(positions, line, currentId, preferredId) {
  let row = [];
  for (const position of positions) {
    if (position.top > line + 2) continue;
    if (!row.length || position.top > row[0].top + 2) row = [position];
    else if (Math.abs(position.top - row[0].top) <= 2) row.push(position);
  }
  // Feature grids have headings side by side. Keep the clicked column active
  // instead of immediately jumping to its neighbour at the same scroll offset.
  return row.find(item => item.id === preferredId)?.id
    || row.find(item => item.id === currentId)?.id
    || row[0]?.id || positions[0]?.id;
}

export function mountArticleTocs(root, isPaused = () => false) {
  if (!root) return () => {};
  const compact = matchMedia('(max-width: 1000px)');
  const ui = getUi().toc;
  const cleanups = [];
  const usedIds = new Set([...document.querySelectorAll('[id]')].map(node => node.id));
  for (const article of root.querySelectorAll('.article-layout')) {
    const aside = article.querySelector('.article-aside');
    const content = article.querySelector('.article-content');
    if (!aside || !content) continue;
    const headings = [...content.querySelectorAll('h2, h3')].filter(heading => heading.textContent.trim());
    if (!headings.length) continue;
    const overview = root.querySelector('.page-title h1');
    if (overview) headings.unshift(overview);

    const info = document.createElement('div');
    info.className = 'article-aside-info';
    info.append(...aside.childNodes);
    const toc = document.createElement('details');
    toc.className = 'article-toc';
    toc.open = !compact.matches;
    const summary = document.createElement('summary');
    summary.textContent = ui.title;
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', summary.textContent);
    const list = document.createElement('ul');
    nav.append(list); toc.append(summary, nav);
    aside.append(info, toc);
    aside.classList.add('has-article-toc');

    const entries = headings.map(heading => {
      const label = heading === overview ? ui.overview : heading.textContent.trim().replace(/\s+/g, ' ');
      if (!heading.id) {
        const base = `section-${heading === overview ? 'overview' : headingSlug(label)}`;
        let id = base, suffix = 2;
        while (usedIds.has(id)) id = `${base}-${suffix++}`;
        heading.id = id; usedIds.add(id);
      }
      const hadTabIndex = heading.hasAttribute('tabindex');
      if (!hadTabIndex) heading.tabIndex = -1;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = label;
      if (heading.tagName === 'H3') link.dataset.level = 'subsection';
      item.append(link); list.append(item);
      return { heading, link, hadTabIndex };
    });

    let frame = 0, activeId = null, preferredId = null, disposed = false;
    const setActive = id => {
      if (id === activeId) return;
      activeId = id;
      for (const { heading, link } of entries) {
        if (heading.id === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    };
    const update = () => {
      frame = 0;
      const line = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 24;
      const positions = entries.map(({ heading }) => ({ id: heading.id, top: heading.getBoundingClientRect().top }));
      setActive(activeHeadingAt(positions, line, activeId, preferredId));
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update);
    };
    const onClick = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a');
      const entry = entries.find(item => item.link === link);
      if (!entry) return;
      event.preventDefault();
      preferredId = entry.heading.id;
      if (location.hash !== link.hash) history.pushState(history.state, '', link.hash);
      setActive(preferredId);
      if (compact.matches) toc.open = false;
      entry.heading.focus({ preventScroll: true });
      entry.heading.scrollIntoView({ behavior: isPaused() ? 'instant' : 'smooth', block: 'start' });
      schedule();
    };
    const onHashChange = () => {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const entry = entries.find(item => item.heading.id === id);
      if (!entry) { schedule(); return; }
      preferredId = id;
      entry.heading.scrollIntoView({ behavior: 'instant', block: 'start' });
      schedule();
    };

    const onLayoutChange = () => { toc.open = !compact.matches; schedule(); };
    nav.addEventListener('click', onClick);
    toc.addEventListener('toggle', schedule);
    compact.addEventListener('change', onLayoutChange);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', onHashChange);
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    document.fonts?.ready.then(() => { if (!disposed) schedule(); });
    onHashChange(); schedule();

    cleanups.push(() => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      nav.removeEventListener('click', onClick);
      toc.removeEventListener('toggle', schedule);
      compact.removeEventListener('change', onLayoutChange);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', onHashChange);
      for (const { heading, hadTabIndex } of entries) if (!hadTabIndex) heading.removeAttribute('tabindex');
      toc.remove();
      info.replaceWith(...info.childNodes);
      aside.classList.remove('has-article-toc');
    });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}
