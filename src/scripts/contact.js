export async function copyContactEmail(button, labels) {
  const card = button.closest('.contact-card');
  const address = card?.querySelector('[data-contact-email]');
  const status = card?.querySelector('[data-contact-status]');
  if (!address || !status) return;
  try {
    await navigator.clipboard.writeText(address.textContent.trim());
    button.classList.add('is-copied');
    button.querySelector('[data-copy-contact-label]').textContent = labels.copied;
    status.textContent = labels.success;
  } catch {
    // Keep the address usable when clipboard access is denied or unavailable.
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(address);
    selection.removeAllRanges();
    selection.addRange(range);
    button.classList.remove('is-copied');
    button.querySelector('[data-copy-contact-label]').textContent = labels.copy;
    status.textContent = labels.fallback;
  }
}
