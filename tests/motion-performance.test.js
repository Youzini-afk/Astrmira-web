import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionQuality, nextFrameTime } from '../src/scripts/motion-quality.js';
import { createParticleGrid } from '../src/scripts/particle-grid.js';

function feed(controller, start, duration, { interval = 1000 / 60, cost = 2, busy = true } = {}) {
  const changes = [];
  let now = start;
  while (now < start + duration) {
    const quality = controller.sample(now, cost, busy);
    if (quality) changes.push(quality.name);
    now += interval;
  }
  return { now, changes };
}

test('device hints select a starting quality without requiring hardware APIs', () => {
  assert.equal(createMotionQuality().current.name, 'full');
  assert.equal(createMotionQuality({ cores: 0, memory: NaN }).current.name, 'full');
  assert.equal(createMotionQuality({ cores: 4 }).current.name, 'balanced');
  assert.equal(createMotionQuality({ cores: 16, memory: 2 }).current.name, 'light');
});

test('sustained slow frame delivery or expensive rendering lowers detail one tier at a time', () => {
  for (const load of [{ interval: 1000 / 30 }, { cost: 11 }]) {
    const controller = createMotionQuality();
    const first = feed(controller, 0, 2200, load);
    assert.deepEqual(first.changes, ['balanced']);
    const second = feed(controller, first.now, 2200, load);
    assert.deepEqual(second.changes, ['light']);
    assert.deepEqual(feed(controller, second.now, 5000, load).changes, []);
  }
});

test('one dropped frame and a hidden-tab gap do not trigger a downgrade', () => {
  const controller = createMotionQuality();
  let { now } = feed(controller, 0, 800);
  controller.sample(now + 120, 3, true);
  assert.deepEqual(feed(controller, now + 140, 1500).changes, []);
  assert.equal(controller.sample(30000, 2, true), null);
  assert.equal(controller.current.name, 'full');
  controller.reset();
  assert.equal(controller.sample(60000, 2, true), null);
});

test('quality recovery requires sustained active animation, never just an idle screen', () => {
  const controller = createMotionQuality({ cores: 2 });
  let result = feed(controller, 0, 12000, { busy: false });
  assert.deepEqual(result.changes, []);
  result = feed(controller, result.now, 4200);
  assert.deepEqual(result.changes, []);
  result = feed(controller, result.now, 2200);
  assert.deepEqual(result.changes, ['balanced']);
  result = feed(controller, result.now, 6200);
  assert.deepEqual(result.changes, ['full']);
});

test('frame pacing retains close to 60 draws on 60 Hz and high refresh displays', () => {
  for (const rate of [60, 60.24, 90, 120, 144]) {
    let last = 0, draws = 0;
    for (let i = 1; i <= rate * 10; i++) {
      const next = nextFrameTime(last, i * 1000 / rate);
      if (next !== null) { last = next; draws++; }
    }
    assert.ok(draws >= 590 && draws <= 610, `${rate} Hz produced ${draws} draws in ten seconds`);
  }
});

test('a frame is either entirely skipped or available to scroll and paint together', () => {
  const previous = nextFrameTime(0, 17);
  assert.equal(nextFrameTime(previous, 20), null);
  const afterStall = nextFrameTime(previous, 230);
  assert.ok(afterStall <= 230 && afterStall > 230 - 1000 / 60);
});

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
