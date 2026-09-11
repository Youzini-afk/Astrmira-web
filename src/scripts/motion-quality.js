// These are visual budgets, not device eligibility rules. Hardware hints only
// select the starting point; observed frame delivery can move either way.
export const MOTION_QUALITY = [
  { name: 'light', dpr: 1, stars: .45, text: .4, strandStep: 3, dust: .4, grain: .55 },
  { name: 'balanced', dpr: 1.25, stars: .7, text: .65, strandStep: 2, dust: .65, grain: .8 },
  { name: 'full', dpr: 1.5, stars: 1, text: 1, strandStep: 1, dust: 1, grain: 1 }
];

export const FRAME_INTERVAL = 1000 / 60;

export function createMotionQuality({ cores, memory } = {}) {
  const limited = value => Number.isFinite(value) && value > 0;
  let level = (limited(cores) && cores <= 2) || (limited(memory) && memory <= 2) ? 0
    : (limited(cores) && cores <= 4) || (limited(memory) && memory <= 4) ? 1 : 2;
  let previous = null, started = null, frames = 0, late = 0;
  let draws = 0, cost = 0, busyDraws = 0, delayedFrames = 0, healthy = 0;

  function reset() {
    previous = started = null;
    frames = late = draws = cost = busyDraws = delayedFrames = healthy = 0;
  }

  return {
    get current() { return MOTION_QUALITY[level]; },
    reset,
    sample(now, renderCost, busy, opening = false, rendererDelayed = false) {
      if (previous === null || (now - previous > 250 && (renderCost === null || renderCost <= FRAME_INTERVAL * .5))) {
        reset(); previous = started = now;
        return null;
      }
      frames++;
      if (now - previous > FRAME_INTERVAL * 1.5) late++;
      previous = now;
      if (renderCost !== null) {
        draws++; cost += renderCost;
        if (busy) busyDraws++;
        if (rendererDelayed) delayedFrames++;
      }
      // The expensive gathering lasts only a few seconds: waiting two seconds
      // between steps leaves most of it on an unsuitable tier.
      if (now - started < (opening ? 650 : 2000) || !draws) return null;

      const meanCost = cost / draws, lateRatio = late / frames;
      let next = level;
      // Leave half a 60 Hz frame for layout, compositing and other page work.
      if (meanCost > FRAME_INTERVAL * .5 || lateRatio > .28 || delayedFrames / draws > .28) {
        next = Math.max(0, level - 1); healthy = 0;
      } else if (meanCost < FRAME_INTERVAL * (opening ? .33 : .25)
        && lateRatio < (opening ? .12 : .05) && delayedFrames === 0 && busyDraws / draws > .5) {
        // A one-off font or GPU startup cost must not pin the whole visit to a
        // low tier. Recovery still needs three healthy windows of real motion.
        if (++healthy >= 3) { next = Math.min(2, level + 1); healthy = 0; }
      } else healthy = 0;
      started = now; frames = late = draws = cost = busyDraws = delayedFrames = 0;
      if (next === level) return null;
      level = next;
      return MOTION_QUALITY[level];
    }
  };
}

// Carry fractional frame time forward so callback jitter does not accumulate
// into a second, uneven cadence on top of the selected display divisor.
export function nextFrameTime(previous, now, interval = FRAME_INTERVAL) {
  if (now - previous < interval - .5) return null;
  return now - Math.max(0, now - previous - interval) % interval;
}

const RATE_CEILING = { light: 60, balanced: 72, full: 100 };
const COMMON_RATES = [60, 72, 75, 90, 100, 120, 144, 165, 180, 240, 360];

export function chooseAnimationRate(displayRate, qualityName = 'full') {
  if (!Number.isFinite(displayRate) || displayRate < 30) return 60;
  const ceiling = RATE_CEILING[qualityName] || RATE_CEILING.full;
  const floor = qualityName === 'light' ? 36 : 45;
  for (let divisor = 1; divisor <= 8; divisor++) {
    const rate = displayRate / divisor;
    if (rate <= ceiling + .75 && rate >= floor) return rate;
  }
  return Math.min(displayRate, ceiling);
}

export function createFramePacer() {
  let previousCallback = null, previousFrame = 0;
  let samples = [], displayRate = 60, targetRate = 60;
  const reset = () => {
    previousCallback = null; previousFrame = 0;
    samples = []; displayRate = targetRate = 60;
  };
  return {
    reset,
    get displayRate() { return displayRate; },
    get targetRate() { return targetRate; },
    next(now, qualityName = 'full') {
      if (previousCallback !== null) {
        const interval = now - previousCallback;
        if (interval >= 2 && interval <= 40) {
          samples.push(interval);
          if (samples.length > 36) samples.shift();
          if (samples.length >= 8) {
            const ordered = [...samples].sort((a, b) => a - b);
            const measured = 1000 / ordered[Math.floor(ordered.length * .2)];
            const common = COMMON_RATES.reduce((best, rate) => Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best);
            displayRate = Math.abs(common - measured) / common < .045 ? common : measured;
          }
        }
      }
      previousCallback = now;
      targetRate = chooseAnimationRate(displayRate, qualityName);
      const frame = nextFrameTime(previousFrame, now, 1000 / targetRate);
      if (frame !== null) previousFrame = frame;
      return frame;
    }
  };
}
