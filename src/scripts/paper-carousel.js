/** Native scrolling handles touch, trackpads and focus; controls add one-card steps. */
export function mountPaperCarousels(root, isPaused = () => false) {
  const disposers = [...root.querySelectorAll('[data-paper-carousel]')].map(carousel => {
    const track = carousel.querySelector('[data-paper-track]');
    const previous = carousel.querySelector('[data-paper-prev]');
    const next = carousel.querySelector('[data-paper-next]');
    const controls = carousel.querySelector('[data-paper-controls]');
    const status = carousel.querySelector('[data-paper-status]');
    let frame = 0;
    let target = track.scrollLeft;
    let animating = false;
    const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const update = () => {
      frame = 0;
      const max = maximum();
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
      controls.hidden = max <= 2;
      if (!animating) target = track.scrollLeft;
      if (Math.abs(track.scrollLeft - target) < 2) animating = false;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const move = direction => {
      const cards = track.children;
      const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
      target = Math.max(0, Math.min(maximum(), (animating ? target : track.scrollLeft) + direction * step));
      animating = true;
      track.scrollTo({ left: target, behavior: isPaused() ? 'instant' : 'smooth' });
    };
    const onPrevious = () => move(-1);
    const onNext = () => move(1);
    const onKey = event => {
      if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    const onManual = () => { animating = false; };
    const onEnd = () => {
      animating = false;
      update();
      const bounds = track.getBoundingClientRect();
      const visible = [...track.children].filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2;
      });
      status.textContent = visible.map(card => card.querySelector('h3').textContent).join(document.documentElement.lang === 'en' ? '; ' : '；');
    };
    previous.addEventListener('click', onPrevious);
    next.addEventListener('click', onNext);
    track.addEventListener('keydown', onKey);
    track.addEventListener('scroll', schedule, { passive: true });
    track.addEventListener('scrollend', onEnd);
    track.addEventListener('pointerdown', onManual, { passive: true });
    track.addEventListener('wheel', onManual, { passive: true });
    const resize = new ResizeObserver(() => { animating = false; schedule(); });
    resize.observe(track);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      previous.removeEventListener('click', onPrevious);
      next.removeEventListener('click', onNext);
      track.removeEventListener('keydown', onKey);
      track.removeEventListener('scroll', schedule);
      track.removeEventListener('scrollend', onEnd);
      track.removeEventListener('pointerdown', onManual);
      track.removeEventListener('wheel', onManual);
    };
  });
  return () => disposers.forEach(dispose => dispose());
}
