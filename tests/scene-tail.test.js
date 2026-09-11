import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleOpeningPath, openingMesh, wakeMesh } from '../src/scripts/scene-tail.js';
const path = 'M-100 720 C140 475, 370 815, 698 474 S993 139, 1125 202';

test('worker curve sampling preserves transformed opening endpoints and monotone progress', () => {
  const points = sampleOpeningPath(path, [2,0,0,2,30,60]);
  assert.equal(points[0].x, -170); assert.equal(points[0].y, 1500);
  assert.equal(points.at(-1).x, 2280); assert.equal(points.at(-1).y, 464);
  assert.equal(points[0].u, 0); assert.equal(points.at(-1).u, 1);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].u > points[i - 1].u);
  const stretched = sampleOpeningPath(path, [3,0,0,.4,10,-50]);
  const original = sampleOpeningPath(path, [1,0,0,1,0,0]);
  assert.deepEqual(stretched.map(p => p.u), original.map(p => p.u), 'responsive scaling must not separate the wake endpoint from the star');
});

test('opening mesh joins separate filaments with zero-area strip edges', () => {
  const strand = { d: path, color: '#719dc4', width: .8, alpha: .08 };
  const single = openingMesh([strand], [1,0,0,1,0,0]), double = openingMesh([strand, strand], [1,0,0,1,0,0]);
  const n = single.length;
  assert.equal(double.length, n * 2 + 26);
  assert.deepEqual(double.slice(n - 13, n), double.slice(n, n + 13));
  assert.deepEqual(double.slice(n + 13, n + 26), double.slice(n + 26, n + 39));
  assert.ok(double.every(Number.isFinite));
});

test('GPU wake meets the exact opening endpoint before expanding into filaments', () => {
  const points = [{ x: 100, y: 120, param: 200, distance: 0 }, { x: 110, y: 140, param: 220, distance: 23 }, { x: 130, y: 160, param: 240, distance: 50 }];
  const mesh = wakeMesh(points, 50, 500, 200);
  assert.equal(mesh[0], 100); assert.equal(mesh[1], 120);
  assert.equal(mesh[6], 0, 'no gap from a pre-expanded fan at the handoff');
  assert.equal(mesh[20], mesh[27], 'both sides share the same filament spread');
  assert.ok(mesh.every(Number.isFinite));
});
