// The gathering guide is the exact nearest particle, without a scan through
// every guide for every glyph sample. Built once for each text layout.
export function createNearestParticleLookup(points) {
  const build = (items, depth) => {
    if (!items.length) return null;
    const axis = depth % 2 ? 'relY' : 'relX';
    items.sort((a, b) => a[axis] - b[axis]);
    const mid = items.length >> 1;
    return { point: items[mid], axis, left: build(items.slice(0, mid), depth + 1), right: build(items.slice(mid + 1), depth + 1) };
  };
  const root = build([...points], 0);
  return (x, y) => {
    let point = null, distance = Infinity;
    const visit = node => {
      if (!node) return;
      const dx = x - node.point.relX, dy = y - node.point.relY;
      const d = dx * dx + dy * dy;
      if (d < distance) { point = node.point; distance = d; }
      const delta = node.axis === 'relX' ? dx : dy;
      visit(delta < 0 ? node.left : node.right);
      if (delta * delta <= distance) visit(delta < 0 ? node.right : node.left);
    };
    visit(root);
    return { point, distance };
  };
}
