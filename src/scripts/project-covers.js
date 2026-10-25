/** Project covers animate only while on screen. Without this script, or with motion
    paused or reduced, they show their composed resting frame. */
export function mountProjectCovers(root) {
  const covers = [...root.querySelectorAll('[data-project-cover]')];
  if (!covers.length || !('IntersectionObserver' in window)) return () => {};
  // Entering view restarts the loop from its composed frame, so it never jumps.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('is-live', entry.isIntersecting);
  }, { rootMargin: '60px 0px' });
  covers.forEach(cover => observer.observe(cover));
  return () => {
    observer.disconnect();
    covers.forEach(cover => cover.classList.remove('is-live'));
  };
}
