import test from 'node:test';
import assert from 'node:assert/strict';
import { createCometPath, setCometDock, cometPoint, createCometTrail, recordCometMotion, fadeCometTrail, visibleCometTrail } from '../src/scripts/comet-path.js';

function fixture(width = 1440, height = 900, y = 4500) {
  const opening = [{ x: 0, y: height * .8 }, { x: width * .79, y: height * .265 }];
  const dock = { x: width < 720 ? width / 2 : width * .29, y };
  return { path: createCometPath(opening, { width, height, heroBottom: height, dock }), opening, dock };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const velocity = (path, param, h) => {
  const a = cometPoint(path, param), b = cometPoint(path, param + h);
  return { x: (b.x - a.x) / h, y: (b.y - a.y) / h };
};

test('docking preserves the incoming helix and slows to a stationary document anchor', () => {
  for (const [width, height] of [[390, 844], [1024, 768], [1920, 1080]]) {
    // Different content heights exercise different phases of the incoming helix.
    for (const y of [3800, 4500, 5300]) {
      const { path, opening, dock } = fixture(width, height, y);
      const plain = createCometPath(opening, { width, height, heroBottom: height });
      const { start, end } = path.dock;
      assert.equal(distance(cometPoint(path, start), cometPoint(plain, start)), 0);
      assert.ok(distance(velocity(path, start, -.01), velocity(path, start, .01)) < .001);
      assert.ok(Math.hypot(...Object.values(velocity(path, end, -.01))) < .00001);
      assert.equal(distance(cometPoint(path, end), dock), 0);
      assert.equal(distance(cometPoint(path, end + height * 4), dock), 0);
      let previous = cometPoint(path, start);
      for (let p = start + 1; p <= end; p++) {
        const point = cometPoint(path, p);
        assert.ok(point.x >= 0 && point.x <= width);
        assert.ok(point.y >= previous.y, 'approach must not loop backwards vertically');
        previous = point;
      }
    }
  }
});

test('parking records the exact endpoint, stops adding history, and lets the whole tail disappear', () => {
  const { path, dock } = fixture();
  const trail = createCometTrail(800);
  recordCometMotion(trail, path, path.dock.start - 10, path.dock.end + 100, 1000);
  assert.equal(distance(trail.points.at(-1), dock), 0);
  const count = trail.points.length, lastMotion = trail.lastMotion;
  recordCometMotion(trail, path, path.dock.end + 100, path.dock.end + 100000, 4000);
  assert.equal(trail.points.length, count);
  assert.equal(trail.lastMotion, lastMotion);
  fadeCometTrail(trail, 7000, true);
  assert.ok(visibleCometTrail(trail).length < 2);

  recordCometMotion(trail, path, path.dock.end + 500, path.dock.end - 200, 8000);
  assert.equal(distance(trail.points.at(-1), cometPoint(path, path.dock.end - 200)), 0);
  assert.equal(trail.lastMotion, 8000);
  assert.ok(trail.points.every(point => point.param <= path.dock.end));
});

test('a deep page load past the dock does not manufacture a flight trail', () => {
  const { path, dock } = fixture();
  const trail = createCometTrail(800);
  recordCometMotion(trail, path, path.dock.end + 10, path.dock.end + 5000, 1000);
  assert.equal(distance(trail.points[0], dock), 0);
  assert.equal(trail.distance, 0);
  assert.equal(visibleCometTrail(trail).length, 0);
});

test('layout changes can relocate the dock while pages without a destination keep travelling', () => {
  const { path } = fixture();
  const destination = { x: 195, y: 5900 };
  setCometDock(path, destination);
  assert.equal(distance(cometPoint(path, path.dock.end + 1), destination), 0);
  setCometDock(path, null);
  assert.ok(distance(cometPoint(path, 6000), cometPoint(path, 7000)) >= 1000);
});
