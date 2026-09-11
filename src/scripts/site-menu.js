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
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  let openedByHover = false;
  const closeLanguages = () => { if (languagePicker) languagePicker.open = false; };
  const closeWork = () => { openedByHover = false; if (workMenu) workMenu.open = false; };
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
  // Native disclosure remains clickable without JavaScript. Hover is an
  // enhancement for desktop pointers, not a prerequisite for touch or keyboard.
  workMenu?.addEventListener('pointerenter', () => {
    if (hover.matches && !compact.matches && !workMenu.open) {
      closeLanguages(); openedByHover = true; workMenu.open = true;
    }
  });
  workTrigger?.addEventListener('click', event => {
    // The first mouse click keeps a hover-opened disclosure open. Keyboard
    // activation and later clicks retain the native toggle behaviour.
    if (openedByHover && event.detail > 0) { event.preventDefault(); openedByHover = false; }
  });
  workMenu?.addEventListener('pointerleave', () => {
    if (hover.matches && !compact.matches && !workMenu.contains(document.activeElement)) closeWork();
  });
  workMenu?.addEventListener('focusout', event => {
    if (event.relatedTarget && !workMenu.contains(event.relatedTarget)) closeWork();
  });
  workMenu?.addEventListener('toggle', () => { if (workMenu.open) closeLanguages(); else openedByHover = false; });
  languagePicker?.addEventListener('toggle', () => { if (languagePicker.open) closeWork(); });
  compact.addEventListener('change', () => {
    if (compact.matches && nav.contains(document.activeElement)) toggle.focus();
    close();
  });
  document.documentElement.classList.add('navigation-ready');
  return close;
}
