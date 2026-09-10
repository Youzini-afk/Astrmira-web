const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

function between(a, b, t) {
  return {
    x: mix(a.x, b.x, t), y: mix(a.y, b.y, t),
    depth: mix(a.depth, b.depth, t), param: mix(a.param, b.param, t),
    u: a.u !== undefined && b.u !== undefined ? mix(a.u, b.u, t) : undefined
  };
}

function sample(points, param) {
  let lo = 0, hi = points.length - 1;
  if (param <= points[lo].param) return { ...points[lo] };
  if (param >= points[hi].param) return { ...points[hi] };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].param <= param) lo = mid;
    else hi = mid;
  }
  return between(points[lo], points[hi], (param - points[lo].param) / (points[hi].param - points[lo].param));
}

// All positions are document coordinates. After the opening, the parameter
// advances vertically with the page rather than counting viewport revolutions.
export function createCometPath(opening, { width, height, heroBottom = 0 }) {
  const margin = Math.max(30, width * .065);
  const right = width - margin;
  let length = 0;
  const entry = opening.length ? opening.map((point, i) => {
    if (i) length += Math.hypot(point.x - opening[i - 1].x, point.y - opening[i - 1].y);
    return { ...point, param: length, depth: 1 };
  }) : [{ x: right, y: height * .32, param: 0, depth: 0 }];
  const anchor = entry[entry.length - 1];
  const bridge = [{ ...anchor }];
  if (heroBottom > 0) {
    const previous = entry[Math.max(0, entry.length - 2)];
    const dx = anchor.x - previous.x, dy = anchor.y - previous.y;
    const tangentLength = Math.hypot(dx, dy);
    const tx = tangentLength ? dx / tangentLength : .8;
    const ty = tangentLength ? dy / tangentLength : .6;
    const lead = Math.min(heroBottom * .2, Math.max(0, right - anchor.x) / Math.max(.1, tx) * .8);
    const p1 = { x: anchor.x + tx * lead, y: anchor.y + Math.max(0, ty) * lead };
    const p2 = { x: right, y: anchor.y + heroBottom * .75 };
    const end = { x: right, y: anchor.y + heroBottom };
    const steps = Math.ceil(heroBottom / 8);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, v = 1 - t;
      const x = v ** 3 * anchor.x + 3 * v * v * t * p1.x + 3 * v * t * t * p2.x + t ** 3 * end.x;
      const y = v ** 3 * anchor.y + 3 * v * v * t * p1.y + 3 * v * t * t * p2.y + t ** 3 * end.y;
      bridge.push({ x, y, param: length + y - anchor.y, depth: 1 - smooth(t) });
    }
  }
  return {
    entry, bridge, heroLength: length, join: length + heroBottom,
    focusY: anchor.y, centerX: width / 2, radius: width / 2 - margin,
    pitch: height * 2.6
  };
}

export function cometPoint(path, param) {
  if (param <= path.heroLength) return sample(path.entry, param);
  if (param <= path.join) return sample(path.bridge, param);
  const angle = (param - path.join) / path.pitch * Math.PI * 2;
  return {
    x: path.centerX + path.radius * Math.cos(angle),
    y: path.focusY + param - path.heroLength,
    depth: Math.sin(angle), param
  };
}

export function createCometTrail(maxLength) {
  return { points: [], distance: 0, rear: 0, lastMotion: 0, maxLength };
}

function prune(trail) {
  let remove = 0;
  while (remove + 1 < trail.points.length && trail.points[remove + 1].distance <= trail.rear) remove++;
  if (remove) trail.points.splice(0, remove);
}

export function recordCometMotion(trail, path, from, to, now) {
  if (!trail.points.length) {
    trail.points.push({ ...cometPoint(path, from), distance: trail.distance });
    trail.lastMotion = now;
  }
  const steps = Math.ceil(Math.abs(to - from) / 8);
  for (let i = 1; i <= steps; i++) {
    const point = cometPoint(path, mix(from, to, i / steps));
    const last = trail.points[trail.points.length - 1];
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (distance < .5) continue;
    trail.distance += distance;
    trail.points.push({ ...point, distance: trail.distance });
    trail.lastMotion = now;
  }
  trail.rear = Math.max(trail.rear, trail.distance - trail.maxLength);
  prune(trail);
}

export function fadeCometTrail(trail, now, dissolve) {
  if (dissolve) {
    const remaining = 1 - smooth((now - trail.lastMotion - 600) / 5200);
    // The rear only advances: faded history never reappears on the next scroll.
    trail.rear = Math.max(trail.rear, trail.distance - trail.maxLength * remaining);
    prune(trail);
  }
}

export function visibleCometTrail(trail) {
  const points = trail.points;
  if (points.length < 2) return [];
  const a = points[0], b = points[1];
  if (a.distance >= trail.rear) return points;
  const t = (trail.rear - a.distance) / (b.distance - a.distance);
  return [{ ...between(a, b, t), distance: trail.rear }, ...points.slice(1)];
}
