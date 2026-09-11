/** Non-modal navigation: taps, keyboard focus and rotation share one state. */
export function mountSiteMenu() {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('[data-menu-toggle]');
  const nav = header?.querySelector('.site-nav');
  if (!toggle || !nav) return () => {};
  const compact = matchMedia('(max-width: 900px)');
  const languagePicker = header.querySelector('[data-language-picker]');
  const languageTrigger = languagePicker?.querySelector('summary');
  const workMenu = header.querySelector('[data-work-menu]');
  const workTrigger = workMenu?.querySelector('summary');
  const closeLanguages = () => { if (languagePicker) languagePicker.open = false; };
  const closeWork = () => { if (workMenu) workMenu.open = false; };
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    if (!open) { closeLanguages(); closeWork(); }
  };
  const close = () => setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('pointerdown', event => {
    if (!languagePicker?.contains(event.target)) closeLanguages();
    if (!workMenu?.contains(event.target)) closeWork();
    if (!header.contains(event.target)) close();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && workMenu?.open) {
      event.preventDefault(); closeWork(); workTrigger.focus(); return;
    }
    if (event.key === 'Escape' && languagePicker?.open) {
      closeLanguages(); languageTrigger.focus(); return;
    }
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    close(); toggle.focus();
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) close();
  });
  languagePicker?.addEventListener('focusout', event => {
    if (event.relatedTarget && !languagePicker.contains(event.relatedTarget)) closeLanguages();
  });
  // Native details handles click, touch and keyboard toggling, including without JS.
  workMenu?.addEventListener('focusout', event => {
    if (event.relatedTarget && !workMenu.contains(event.relatedTarget)) closeWork();
  });
  workMenu?.addEventListener('toggle', () => { if (workMenu.open) closeLanguages(); });
  languagePicker?.addEventListener('toggle', () => { if (languagePicker.open) closeWork(); });
  compact.addEventListener('change', () => {
    if (compact.matches && nav.contains(document.activeElement)) toggle.focus();
    close();
  });
  document.documentElement.classList.add('navigation-ready');
  return close;
}
