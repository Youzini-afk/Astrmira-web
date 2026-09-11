let messages;
export function getUi() {
  return messages ||= JSON.parse(document.getElementById('site-ui').textContent);
}
export function format(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, key) => key in values ? String(values[key]) : match);
}
export function countLabel(group, count) {
  const ui = getUi()[group];
  const one = new Intl.PluralRules(document.documentElement.lang).select(count) === 'one';
  return format(one ? ui.countOne : ui.count, { count });
}
