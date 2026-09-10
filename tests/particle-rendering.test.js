import test from 'node:test';
import assert from 'node:assert/strict';
import { createNearestParticleLookup } from '../src/scripts/nearest-particle.js';
import { setGlyphCoverage, sampleGlyphCoverage } from '../src/scripts/glyph-coverage.js';
import { createMotionQuality } from '../src/scripts/motion-quality.js';

test('guide lookup agrees with an exhaustive search, including outside the cloud', () => {
  const points = Array.from({ length: 301 }, (_, i) => ({ relX: Math.sin(i * 1.7) * 800, relY: Math.cos(i * 2.3) * 300 }));
  const nearest = createNearestParticleLookup(points);
  for (let i = 0; i < 80; i++) {
    const x = i * 27 - 1000, y = Math.sin(i) * 900;
    const expected = Math.min(...points.map(p => (p.relX - x) ** 2 + (p.relY - y) ** 2));
    assert.equal(nearest(x, y).distance, expected);
  }
  assert.deepEqual(createNearestParticleLookup([])(0, 0), { point: null, distance: Infinity });
});

test('incremental mask coverage preserves untouched particles across disturbance and settling', () => {
  const cell = { count: 3, sum: 3 }, layer = { active: false };
  const particles = Array.from({ length: 3 }, () => ({ coverage: 1, glyphCell: cell, glyphLayer: layer }));
  setGlyphCoverage(particles[0], .2);
  assert.ok(Math.abs(cell.sum - 2.2) < 1e-10);
  setGlyphCoverage(particles[1], .5);
  assert.ok(Math.abs(cell.sum - 1.7) < 1e-10);
  setGlyphCoverage(particles[0], .2);
  assert.ok(Math.abs(cell.sum - 1.7) < 1e-10, 'unchanged coverage must not add another contribution');
  setGlyphCoverage(particles[0], 1); setGlyphCoverage(particles[1], 1);
  assert.equal(cell.sum, 3);
  assert.equal(layer.active, true);
});

test('particle alpha follows the same bilinear mask as the high-resolution glyph', () => {
  const particle = { glyphLayer: { alphaData: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 0]) }, glyphSample: { indices: [3, 7, 11, 15], weights: [.25, .25, .25, .25] } };
  assert.equal(sampleGlyphCoverage(particle), .5);
  particle.glyphLayer.alphaData.fill(255);
  assert.equal(sampleGlyphCoverage(particle), 1);
});

test('opening feedback can reduce work within the first second', () => {
  const quality = createMotionQuality();
  const changes = [];
  for (let now = 0; now <= 900; now += 30) {
    const next = quality.sample(now, 12, true, true);
    if (next) changes.push(next.name);
  }
  assert.deepEqual(changes, ['balanced', 'light']);
});

test('a heavily overloaded opening is not mistaken for a background-tab gap', () => {
  const quality = createMotionQuality();
  quality.sample(0, 60, true, true);
  assert.equal(quality.sample(500, 60, true, true)?.name, 'balanced');
  assert.equal(quality.sample(1000, 60, true, true)?.name, 'light');
});
