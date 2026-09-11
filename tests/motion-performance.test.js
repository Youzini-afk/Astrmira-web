import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleGrid } from '../src/scripts/particle-grid.js';

test('text lookup includes pointer neighbours and displaced particles without scanning the whole title', () => {
  const particles = [];
  for (let y = -20; y < 300; y += 2) for (let x = -20; x < 1400; x += 2) particles.push({ relX: x, relY: y });
  const grid = createParticleGrid(particles);
  const displaced = particles.at(-1);
  const near = grid.near(300, 70, 82, new Set([displaced]));
  assert.ok(near.has(displaced));
  for (const p of particles) {
    if (Math.hypot(p.relX - 300, p.relY - 70) <= 82) assert.ok(near.has(p));
  }
  assert.ok(near.size < particles.length * .2);
  assert.equal(grid.near(-9999, -9999, 82, [displaced]).size, 1);
});
