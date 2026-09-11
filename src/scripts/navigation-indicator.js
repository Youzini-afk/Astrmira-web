/** A decorative highlight follows native links without intercepting navigation. */
export function mountNavigationIndicator() {
  const group = document.querySelector('[data-nav-group]');
  const indicator = group?.querySelector('[data-nav-indicator]');
  if (!indicator) return () => {};
  const links = [...group.querySelectorAll('[data-nav-link]')];
  let hovered = null;
  let frame = 0;

  const paint = (animate = true) => {
    cancelAnimationFrame(frame);
    if (!group.offsetWidth || !group.offsetHeight) {
      group.classList.remove('has-nav-indicator', 'nav-positioning');
      return;
    }
    const focused = links.find(link => link === document.activeElement);
    const target = hovered || focused || links.find(link => link.getAttribute('aria-current') === 'page');
    const canAnimate = animate && group.classList.contains('has-nav-indicator') && group.classList.contains('has-nav-target');
    group.classList.toggle('nav-positioning', !canAnimate);
    if (target) {
      // Read only on interaction/layout changes; no pointermove or animation loop.
      const { offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height } = target;
      group.style.setProperty('--nav-x', x + 'px');
      group.style.setProperty('--nav-y', y + 'px');
      group.style.setProperty('--nav-width', width + 'px');
      group.style.setProperty('--nav-height', height + 'px');
    }
    for (const link of links) link.classList.toggle('is-highlighted', link === target);
    group.classList.add('has-nav-indicator');
    group.classList.toggle('has-nav-target', Boolean(target));
    if (!canAnimate) frame = requestAnimationFrame(() => group.classList.remove('nav-positioning'));
  };
  const restore = () => { hovered = null; paint(); };
  group.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const link = event.target.closest('[data-nav-link]');
    if (!links.includes(link) || hovered === link) return;
    hovered = link;
    paint();
  });
  group.addEventListener('pointerleave', restore);
  group.addEventListener('focusin', restore);
  group.addEventListener('focusout', () => queueMicrotask(() => paint()));
  const resize = new ResizeObserver(() => paint(false));
  resize.observe(group);
  document.fonts?.ready.then(() => paint(false));
  paint(false);
  // The single-file preview changes the active route without replacing its header.
  return () => { hovered = null; paint(false); };
}
