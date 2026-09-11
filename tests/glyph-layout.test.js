import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphSurfaceBounds } from '../src/scripts/motion-layout.js';

test('the cropped glyph surface contains every run and aligns to device pixels', () => {
  for (const dpr of [1, 1.25, 2, 3]) {
    const runs = [
      { left: -6.4, top: 43.15, dpr, bitmap: { width: 173, height: 64 } },
      { left: 274.33, top: 301.77, dpr, bitmap: { width: 302, height: 149 } }
    ];
    const bounds = glyphSurfaceBounds(runs, dpr);
    for (const n of Object.values(bounds)) assert.ok(Math.abs(n * dpr - Math.round(n * dpr)) < 1e-8);
    for (const run of runs) {
      assert.ok(bounds.left <= run.left && bounds.top <= run.top);
      assert.ok(bounds.left + bounds.width >= run.left + run.bitmap.width / dpr);
      assert.ok(bounds.top + bounds.height >= run.top + run.bitmap.height / dpr);
    }
    assert.ok(Math.min(...runs.map(r => r.left)) - bounds.left < 1 / dpr);
    assert.ok(Math.min(...runs.map(r => r.top)) - bounds.top < 1 / dpr);
  }
});

test('pages without hero lettering allocate no visible glyph surface', () => {
  assert.deepEqual(glyphSurfaceBounds([], 3), { left: 0, top: 0, width: 0, height: 0 });
});
