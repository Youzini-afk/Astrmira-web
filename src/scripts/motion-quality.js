// These are visual budgets, not device eligibility rules. Hardware hints only
// select the starting point; observed frame delivery can move either way.
export const MOTION_QUALITY = [
  { name: 'light', dpr: 1, stars: .45, text: .4, strandStep: 3, dust: .4 },
  { name: 'balanced', dpr: 1.25, stars: .7, text: .65, strandStep: 2, dust: .65 },
  { name: 'full', dpr: 1.5, stars: 1, text: 1, strandStep: 1, dust: 1 }
];

export const FRAME_INTERVAL = 1000 / 60;

export function createMotionQuality({ cores, memory } = {}) {
  const limited = value => Number.isFinite(value) && value > 0;
  let level = (limited(cores) && cores <= 2) || (limited(memory) && memory <= 2) ? 0
    : (limited(cores) && cores <= 4) || (limited(memory) && memory <= 4) ? 1 : 2;
  let previous = null, started = null, frames = 0, late = 0;
  let draws = 0, cost = 0, busyDraws = 0, healthy = 0;

  function reset() {
    previous = started = null;
    frames = late = draws = cost = busyDraws = healthy = 0;
  }

  return {
    get current() { return MOTION_QUALITY[level]; },
    reset,
    sample(now, renderCost, busy) {
      if (previous === null || now - previous > 250) {
        reset(); previous = started = now;
        return null;
      }
      frames++;
      if (now - previous > FRAME_INTERVAL * 1.5) late++;
      previous = now;
      if (renderCost !== null) { draws++; cost += renderCost; if (busy) busyDraws++; }
      if (now - started < 2000 || !draws) return null;

      const meanCost = cost / draws, lateRatio = late / frames;
      let next = level;
      // Leave half a 60 Hz frame for layout, compositing and other page work.
      if (meanCost > FRAME_INTERVAL * .5 || lateRatio > .2) {
        next = Math.max(0, level - 1); healthy = 0;
      } else if (meanCost < FRAME_INTERVAL * .25 && lateRatio < .05 && busyDraws / draws > .5) {
        // Recovery needs six seconds of real animation, not an idle screen.
        if (++healthy >= 3) { next = Math.min(2, level + 1); healthy = 0; }
      } else healthy = 0;
      started = now; frames = late = draws = cost = busyDraws = 0;
      if (next === level) return null;
      level = next;
      return MOTION_QUALITY[level];
    }
  };
}

// Carry fractional frame time forward so 16.6 ms callbacks don't accidentally
// become alternating draw/skip frames on a 60 Hz display.
export function nextFrameTime(previous, now) {
  if (now - previous < FRAME_INTERVAL - .5) return null;
  return now - Math.max(0, now - previous - FRAME_INTERVAL) % FRAME_INTERVAL;
}
