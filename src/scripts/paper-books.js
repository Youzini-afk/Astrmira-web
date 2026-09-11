/** Event-driven covers; unenhanced HTML presents both faces in reading order. */
export function mountPaperBooks(root) {
  const disposers = [...root.querySelectorAll('[data-paper-book]')].map(card => {
    const cover = card.querySelector('[data-paper-cover]');
    const preview = card.querySelector('[data-paper-preview]');
    const toggle = card.querySelector('[data-paper-toggle]');
    const label = toggle.querySelector('[data-paper-toggle-label]');
    const title = card.querySelector('h2,h3').textContent;
    let pinned = false;
    let hovering = false;
    let dismissed = false;
    const open = () => pinned || (!dismissed && (hovering || preview.contains(document.activeElement)));
    const update = () => {
      const expanded = open();
      const text = expanded ? toggle.dataset.closeLabel : toggle.dataset.openLabel;
      card.classList.toggle('is-open', expanded);
      preview.inert = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', text + ' · ' + title);
      label.textContent = text;
    };
    const enter = event => {
      if (event.pointerType !== 'mouse' || !matchMedia('(any-hover: hover)').matches) return;
      hovering = true;
      dismissed = false;
      update();
    };
    const leave = () => { hovering = false; dismissed = false; update(); };
    const flip = event => {
      pinned = !open();
      dismissed = !pinned;
      update();
      if (pinned && event.detail === 0) preview.querySelector('a')?.focus({ preventScroll: true });
    };
    const openCover = () => {
      if (!window.getSelection()?.isCollapsed) return;
      pinned = true;
      dismissed = false;
      update();
    };
    const focusChanged = () => { queueMicrotask(update); };
    const key = event => {
      if (event.key !== 'Escape' || !open()) return;
      event.preventDefault();
      pinned = false;
      dismissed = true;
      if (preview.contains(document.activeElement)) toggle.focus({ preventScroll: true });
      update();
    };
    card.classList.add('is-book');
    toggle.hidden = false;
    update();
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card.addEventListener('focusin', focusChanged);
    card.addEventListener('focusout', focusChanged);
    card.addEventListener('keydown', key);
    cover.addEventListener('click', openCover);
    toggle.addEventListener('click', flip);
    return () => {
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      card.removeEventListener('focusin', focusChanged);
      card.removeEventListener('focusout', focusChanged);
      card.removeEventListener('keydown', key);
      cover.removeEventListener('click', openCover);
      toggle.removeEventListener('click', flip);
      preview.inert = false;
      toggle.hidden = true;
      card.classList.remove('is-book', 'is-open');
    };
  });
  return () => disposers.forEach(dispose => dispose());
}
