export function resolveContactEmail(value) {
  const email = value?.trim() || 'contact@astrmira.com';
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/u.test(email)) {
    throw new Error('PUBLIC_CONTACT_EMAIL must contain a single email address.');
  }
  return email;
}
