const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

// Both homepages use two cubic segments (M C S). Sampling is done once in the
// worker; DOM path APIs and SVG masks are absent from the animation loop.
export function sampleOpeningPath(d, matrix, steps = 160) {
  const n = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
  if (n.length !== 12) throw new Error('Opening path must contain M C S');
  const curves = [n.slice(0, 8), [n[6], n[7], n[6] * 2 - n[4], n[7] * 2 - n[5], ...n.slice(8)]];
  const points = [];
  let distance = 0, previousLocal = null;
  for (const curve of curves) {
    for (let i = points.length ? 1 : 0; i <= steps; i++) {
      const t = i / steps, v = 1 - t;
      const x = v ** 3 * curve[0] + 3 * v * v * t * curve[2] + 3 * v * t * t * curve[4] + t ** 3 * curve[6];
      const y = v ** 3 * curve[1] + 3 * v * v * t * curve[3] + 3 * v * t * t * curve[5] + t ** 3 * curve[7];
      const point = { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] };
      // SVG pathLength and getPointAtLength use local arc length, even when the
      // path is stretched differently on each axis by the responsive layout.
      if (previousLocal) distance += Math.hypot(x - previousLocal.x, y - previousLocal.y);
      previousLocal = { x, y };
      point.distance = distance; points.push(point);
    }
  }
  return points.map(p => ({ ...p, u: p.distance / distance }));
}

export function openingMesh(paths, matrix) {
  const vertices = [];
  for (const path of paths) {
    const points = sampleOpeningPath(path.d, matrix), colour = rgb(path.color);
    const strip = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], p = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const side of [-1, 1]) strip.push(p.x, p.y, -(b.y - a.y) / length, (b.x - a.x) / length, p.u, side, 0, ...colour, path.alpha * .85, path.width, 0);
    }
    // Degenerate strip joins never connect the end of one filament to the next.
    if (vertices.length) vertices.push(...vertices.slice(-13), ...strip.slice(0, 13));
    for (const value of strip) vertices.push(value);
  }
  return new Float32Array(vertices);
}

export const strandInstances = strands => new Float32Array(strands.flatMap(s => [...rgb(s.color), s.alpha, s.width, s.offset]));

export function wakeMesh(points, front, maxLength, heroLength) {
  const first = points.findIndex(p => p.param > heroLength);
  if (first < 0) return new Float32Array();
  const nodes = points.slice(Math.max(0, first - 1));
  const data = new Float32Array(nodes.length * 14);
  let at = 0;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[Math.max(0, i - 1)], b = nodes[Math.min(nodes.length - 1, i + 1)], p = nodes[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const spread = Math.pow(Math.max(0, front - p.distance) / maxLength, 1.2)
      * smooth((p.param - heroLength) / Math.min(180, maxLength * .2));
    for (const side of [-1, 1]) {
      data[at++] = p.x; data[at++] = p.y;
      data[at++] = -(b.y - a.y) / length; data[at++] = (b.x - a.x) / length;
      data[at++] = p.distance; data[at++] = side; data[at++] = spread;
    }
  }
  return data;
}
