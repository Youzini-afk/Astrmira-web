import test from 'node:test';
import assert from 'node:assert/strict';
import { createCometPath, createCometTrail, recordCometMotion, fadeCometTrail, visibleCometTrailSegments } from '../src/scripts/comet-path.js';

// A straight portion makes travelled distances and reversal boundaries explicit.
const path = createCometPath([{ x: 100, y: 0, u: 0 }, { x: 100, y: 2000, u: 1 }], { width: 800, height: 800 });

test('a reversal separates the two directions and fades only the old leg within 300 ms', () => {
  const trail = createCometTrail(1000);
  recordCometMotion(trail, path, 100, 600, 0);
  assert.equal(recordCometMotion(trail, path, 600, 450, 100), true);
  let segments = visibleCometTrailSegments(trail);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].points.at(-1).param, 600);
  assert.equal(segments[1].points[0].param, 600);
  for (let i = 1; i < segments[0].points.length; i++) assert.ok(segments[0].points[i].param > segments[0].points[i - 1].param);
  for (let i = 1; i < segments[1].points.length; i++) assert.ok(segments[1].points[i].param < segments[1].points[i - 1].param);

  fadeCometTrail(trail, 250, true);
  segments = visibleCometTrailSegments(trail);
  assert.ok(segments[0].opacity > 0 && segments[0].opacity < 1);
  assert.equal(segments[1].opacity, 1);
  fadeCometTrail(trail, 400, true);
  segments = visibleCometTrailSegments(trail);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].points[0].param, 600);
  assert.equal(segments[0].points.at(-1).param, 450);
  assert.equal(segments[0].opacity, 1);
});

test('repeated reversals do not prolong any earlier leg or stretch its endpoint', () => {
  const trail = createCometTrail(2000);
  recordCometMotion(trail, path, 100, 600, 0);
  recordCometMotion(trail, path, 600, 400, 100);
  recordCometMotion(trail, path, 400, 650, 200);
  recordCometMotion(trail, path, 650, 450, 300);
  assert.equal(visibleCometTrailSegments(trail)[0].distance, 500);
  fadeCometTrail(trail, 400, true);
  let segments = visibleCometTrailSegments(trail);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].points[0].param, 600);
  assert.equal(segments[0].points.at(-1).param, 400);
  assert.equal(segments.at(-1).opacity, 1);
  fadeCometTrail(trail, 600, true);
  segments = visibleCometTrailSegments(trail);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].points[0].param, 650);
  assert.equal(segments[0].points.at(-1).param, 450);
});

test('small back-and-forth jitter stays intact, while sustained slow reversal is detected', () => {
  const trail = createCometTrail(1000);
  recordCometMotion(trail, path, 100, 600, 0);
  assert.equal(recordCometMotion(trail, path, 600, 599, 20), false);
  assert.equal(recordCometMotion(trail, path, 599, 600, 40), false);
  assert.equal(recordCometMotion(trail, path, 600, 599, 60), false);
  assert.equal(recordCometMotion(trail, path, 599, 598, 80), false);
  assert.equal(recordCometMotion(trail, path, 598, 597, 100), true);
  assert.equal(trail.turns.length, 1);
});

test('ordinary travel and the existing hero handoff keep one continuous wake', () => {
  const trail = createCometTrail(1000);
  recordCometMotion(trail, path, 1950, 2150, 0);
  recordCometMotion(trail, path, 2150, 2300, 100);
  fadeCometTrail(trail, 400, true);
  const segments = visibleCometTrailSegments(trail);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].opacity, 1);
  assert.ok(segments[0].points.some(point => point.param === path.heroLength));
});
