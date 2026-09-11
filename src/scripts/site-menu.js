/** Non-modal navigation: taps, keyboard focus and rotation share one state. */
export function mountSiteMenu() {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('[data-menu-toggle]');
  const nav = header?.querySelector('.site-nav');
  if (!toggle || !nav) return () => {};
  const compact = matchMedia('(max-width: 900px)');
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  const close = () => setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('pointerdown', event => { if (!header.contains(event.target)) close(); }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    close(); toggle.focus();
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) close();
  });
  compact.addEventListener('change', () => {
    if (compact.matches && nav.contains(document.activeElement)) toggle.focus();
    close();
  });
  document.documentElement.classList.add('navigation-ready');
  return close;
}
