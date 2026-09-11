import { createCometTrail, recordCometMotion, fadeCometTrail, visibleCometTrailSegments, cometPoint, cometTurnOpacity } from './comet-path.js';
import { createParticleGrid } from './particle-grid.js';
import { createNearestParticleLookup } from './nearest-particle.js';
import { setGlyphCoverage, sampleGlyphCoverage } from './glyph-coverage.js';
import { openingMesh, strandInstances, wakeMesh } from './scene-tail.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const INTRO_DURATION = 4800;
function seeded(n) { let value = n >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
const VAN_GOGH_PALETTE = [[226,192,133],[248,220,160],[142,184,216],[72,122,168],[206,172,120],[252,206,116],[108,156,196]];

// This module has no DOM access. Sampling, particle physics, masks and wake
// history belong to the worker, not the document's input/scrolling thread.
export function createMotionScene(layout, renderer, initialInput) {
  let input = initialInput;
  const vw = layout.width, vh = layout.height;
  const particlePainter = renderer, glyphLayers = [];
  const quality = { dust: 1, grain: 1 };
  let stars = [], renderStars = [], textParticles = [], allIntroQueue = [], introQueue = [], introCursor = 0;
  let particleGrid, activeTextParticles = new Set();
  let paused = false, solidified = false, introStart = 0, heroDeparture = false, heroContentOpacity = 1;
  let starX = 0, starY = 0, prevStarX = 0, prevStarY = 0, prevCometX = 0, prevCometY = 0;
  let cometWorld = { x: 0, y: 0 }, cometParam = null, cometPath = layout.path, cometHasDeparted = false;
  let cometTrail = createCometTrail(Math.hypot(vw, vh) * .82);
  let mouseX = -9999, mouseY = -9999, mouseVx = 0, mouseVy = 0, pointerX = 0, pointerY = 0;
  let textOriginX = (layout.hero?.left || 0) - input.scrollX, textOriginY = (layout.hero?.top || 0) - input.scrollY;
  let stardustSparks = [], cometSparkBudget = 0, textSparkBudget = 0, lastPaint = 0, lastGlyphUpdate = 0;
  let pointerSequence = -1, replaySequence = -1, frameCount = 0;
      const rand = seeded(7261);
      // Uneven density, mostly faint stars, and a few brighter nearby stars.
      // Density follows viewport area so small screens retain dark space.
      const count = Math.round(vw * vh / 2400);
      stars = Array.from({ length: count }, (_, index) => {
        let nx, ny;
        do {
          nx = rand(); ny = rand();
        } while (rand() > 0.48 + 0.32 * Math.exp(-Math.pow((ny - 0.68 + nx * 0.36) / 0.24, 2)));
        const ox = nx * vw, oy = ny * vh;
        const depth = rand();
        const r = 0.35 + Math.pow(depth, 3) * 1.05;
        const o = 0.13 + Math.pow(depth, 2) * 0.62;
        const motion = rand();
        const wander = motion < 0.42 ? 0 : motion < 0.88 ? 2 : 7;
        return {
          x: ox, y: oy, origX: ox, origY: oy,
          vx: 0, vy: 0,
          r, o,
          p: rand() * 6.28,
          wanderSpeed: 0.0015 + rand() * 0.003,
          wanderRadiusX: wander * (0.5 + rand()),
          wanderRadiusY: wander * (0.4 + rand() * 0.6),
          breathPhase: rand() * Math.PI * 2,
          breathPeriod: 4600 + rand() * 6200,
          breathAmount: .045 + depth * .075,
          glow: 0,
          depth,
          detailRank: (index * .61803398875) % 1,
          isGold: rand() > 0.77,
          gathers: rand() < 0.36,
          textParticle: null
        };
      });
  renderStars = stars;

  for (const descriptor of layout.glyphs) {
    const { bitmap, left: startX, top: startY, dpr, isTitle, fontSize, rgb: targetRgb } = descriptor;
    const glyph = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = glyph.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const imgData = ctx.getImageData(0, 0, glyph.width, glyph.height).data;
    const w = glyph.width / dpr, h = glyph.height / dpr, isSmall = fontSize <= 18, isAlreadySolidified = true;
    const cellSize = isTitle ? 12 : 6, columns = Math.ceil(w / cellSize) + 1, rows = Math.ceil(h / cellSize) + 1;
    const alphaData = new Uint8Array(columns * rows * 4);
    for (let i = 0; i < alphaData.length; i += 4) alphaData[i] = alphaData[i + 1] = alphaData[i + 2] = 255;
    const glyphLayer = { glyph, dpr, left: startX, top: startY, cellSize, columns, rows, alphaData,
      particles: [], active: true, needsPaint: true,
      cells: Array.from({ length: columns * rows }, (_, i) => ({ x: i % columns, y: Math.floor(i / columns), count: 0, sum: 0, alpha: 1, source: null }))
    };
    glyphLayers.push(glyphLayer);
    const points = textParticles, lineStep = isTitle ? 2.8 : isSmall ? 1.5 : 2.2;
      for (let py = 0; py < h; py += lineStep) {
        for (let px = 0; px < w; px += lineStep) {
          const idx = (Math.floor(py * dpr) * glyph.width + Math.floor(px * dpr)) * 4;
          const pixelAlpha = imgData[idx + 3] / 255;
          if (pixelAlpha > 0.18) {
            const relX = startX + px;
            const relY = startY + py;

            const vanGoghRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
            const targetRadius = isTitle ? 1.0 : (isSmall ? 0.65 : 0.82);
            const swirlDir = Math.random() < 0.5 ? -1 : 1;

            const particle = {
              relX, relY,
              x: (layout.hero?.left || 0) - input.scrollX + relX,
              y: (layout.hero?.top || 0) - input.scrollY + relY,
              vx: 0, vy: 0,
              vanGoghRgb,
              targetColorRgb: targetRgb,
              targetAlpha: pixelAlpha,
              radius: targetRadius,
              swirlDir,
              baseAlpha: pixelAlpha,
              glow: 0,
              detailRank: Math.random(),
              isTitle,
              isSmall,
              settled: isAlreadySolidified,
              dislodged: false,
              dislodgedFactor: 0
            };
            if (glyphLayer) {
              particle.glyphX = px;
              particle.glyphY = py;
              particle.glyphBlend = 0;
              particle.glyphLayer = glyphLayer;
              const gx = px / glyphLayer.cellSize, gy = py / glyphLayer.cellSize;
              const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
              particle.glyphSample = {
                indices: [iy * glyphLayer.columns + ix, iy * glyphLayer.columns + ix + 1,
                  (iy + 1) * glyphLayer.columns + ix, (iy + 1) * glyphLayer.columns + ix + 1].map(index => index * 4 + 3),
                weights: [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
              };
              particle.glyphCell = glyphLayer.cells[Math.round(py / glyphLayer.cellSize) * glyphLayer.columns + Math.round(px / glyphLayer.cellSize)];
              particle.glyphCell.count++;
              particle.coverage = isAlreadySolidified && !introStart ? 1 : 0;
              particle.glyphCell.sum += particle.coverage;
              glyphLayer.particles.push(particle);
            }
            points.push(particle);
          }
        }
      }
    finishGlyphLayer(glyphLayer);
    renderer.createGlyph(glyphLayer);
  }
  prepareTextIntro({ left: textOriginX, top: textOriginY });
  introQueue = allIntroQueue;
  particleGrid = createParticleGrid(textParticles);
  renderer.setTail(openingMesh(layout.openingPaths, layout.matrix), strandInstances(layout.strands));
  function prepareTextIntro(heroRect) {
    const rand = seeded(1947);
    const titlePoints = textParticles.filter(p => p.isTitle);
    const copyPoints = textParticles.filter(p => !p.isTitle);
    const gathered = [];
    stars.forEach(s => { s.textParticle = null; });
    textParticles.forEach(p => { p.sourceStar = null; });

    // Recruit a minority of the existing sky. The other stars keep their
    // positions and motion throughout the opening, rather than being replaced.
    for (const s of stars) {
      if (!s.gathers) continue;
      const pool = rand() < 0.82 && titlePoints.length ? titlePoints : copyPoints;
      if (!pool.length) continue;
      const p = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      s.textParticle = p;
      p.sourceStar = s;
      p.startRelX = s.x - heroRect.left;
      p.startRelY = s.y - heroRect.top;
      p.delay = 420 + rand() * 1200;
      p.travelDuration = 1650 + rand() * 1050;
      p.bend = (rand() - 0.5) * Math.min(150, Math.hypot(p.relX - p.startRelX, p.relY - p.startRelY) * 0.4);
      gathered.push(p);
    }

    const nearestGuide = createNearestParticleLookup(gathered);
    const cellGuides = new Map();
    for (const p of textParticles) {
      if (p.sourceStar) continue;
      // Glyph detail develops locally around arriving stars. It never starts
      // as thousands of equally bright specks scattered over the viewport.
      // A mask cell shares one guide; nearby stroke detail still gets its own
      // timing jitter. This avoids repeating a spatial query for every pixel.
      const cell = p.glyphCell;
      if (!cellGuides.has(cell)) cellGuides.set(cell, nearestGuide(p.relX, p.relY).point);
      const nearest = cellGuides.get(cell);
      const distance = nearest ? (p.relX - nearest.relX) ** 2 + (p.relY - nearest.relY) ** 2 : Infinity;
      const angle = rand() * Math.PI * 2;
      const radius = 5 + rand() * (p.isTitle ? 24 : 10);
      p.startRelX = p.relX + Math.cos(angle) * radius;
      p.startRelY = p.relY + Math.sin(angle) * radius;
      p.travelDuration = 650 + rand() * 400;
      const revealAt = nearest
        ? nearest.delay + nearest.travelDuration * 0.68 + Math.min(Math.sqrt(distance) * 2, 260) + rand() * 240
        : 1900 + rand() * 900;
      p.delay = Math.min(revealAt, INTRO_DURATION - p.travelDuration - 120);
      p.bend = 0;
    }
    for (const p of textParticles) {
      p.travelX = p.relX - p.startRelX;
      p.travelY = p.relY - p.startRelY;
      const length = Math.hypot(p.travelX, p.travelY) || 1;
      p.arcX = -p.travelY / length * p.bend;
      p.arcY = p.travelX / length * p.bend;
    }
    allIntroQueue = textParticles.filter(p => !p.sourceStar).sort((a, b) => a.delay - b.delay);
  }

  function finishGlyphLayer(layer) {
    // Grow neighbouring stroke coverage through empty cells in one grid pass,
    // rather than comparing every empty cell with every occupied cell.
    const queue = [];
    layer.cells.forEach((cell, i) => { cell.source = null; if (cell.count) queue.push(i); });
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head], cell = layer.cells[index];
      const neighbours = [];
      if (cell.x > 0) neighbours.push(index - 1);
      if (cell.x + 1 < layer.columns) neighbours.push(index + 1);
      if (cell.y > 0) neighbours.push(index - layer.columns);
      if (cell.y + 1 < layer.rows) neighbours.push(index + layer.columns);
      for (const next of neighbours) {
        const target = layer.cells[next];
        if (target.count || target.source) continue;
        target.source = cell.count ? cell : cell.source;
        queue.push(next);
      }
    }
  }

  function updateGlyphLayers(heroLeft, heroTop, frameStep, now) {
    const glyphStep = lastGlyphUpdate ? clamp((now - lastGlyphUpdate) / (1000 / 60), 0, 3) : frameStep;
    lastGlyphUpdate = now;
    for (const layer of glyphLayers) {
      if (!introStart && !layer.active && !layer.needsPaint) continue;
      let changing = false;
      const downBlend = 1 - Math.exp(-glyphStep / 4), upBlend = 1 - Math.exp(-glyphStep / 7);
      for (const cell of layer.cells) {
        if (!cell.count) continue;
        const target = clamp(cell.sum / cell.count, 0, 1);
        const blend = target < cell.alpha ? downBlend : upBlend;
        cell.alpha = paused ? target : cell.alpha + (target - cell.alpha) * blend;
        if (Math.abs(target - cell.alpha) < 0.002) cell.alpha = target;
        if (cell.alpha !== target) changing = true;
      }
      let changed = layer.needsPaint;
      for (let i = 0; i < layer.cells.length; i++) {
        const cell = layer.cells[i];
        if (!cell.count) cell.alpha = cell.source?.alpha || 0;
        const alpha = Math.round(cell.alpha * 255);
        const index = i * 4 + 3;
        if (layer.alphaData[index] !== alpha) changed = true;
        layer.alphaData[index] = alpha;
      }

      // Moving particles sample this mask on demand when they are drawn.
      layer.active = changing;

      if (!changed) continue;
      renderer.updateMask(layer);
      layer.needsPaint = false;
    }
  }

  function settleHeroText(left, top) {
    solidified = true;
    for (const p of textParticles) {
      p.x = left + p.relX; p.y = top + p.relY;
      p.settled = true; p.dislodged = false; p.dislodgedFactor = 0;
      p.vx = p.vy = p.glow = 0;
      setGlyphCoverage(p, 1);
    }
    introCursor = introQueue.length;
    textOriginX = left; textOriginY = top;
  }

  function paintParticlesAndStars(now) {
    const frameStep = lastPaint ? clamp((now - lastPaint) / (1000 / 60), 0, 3) : 1;
    lastPaint = now;

    const starVx = starX - prevStarX;
    const starVy = starY - prevStarY;
    prevStarX = starX; prevStarY = starY;
    const cometVx = cometWorld.x - prevCometX, cometVy = cometWorld.y - prevCometY;
    const cometMovingSpeed = Math.hypot(cometVx, cometVy);
    prevCometX = cometWorld.x; prevCometY = cometWorld.y;

    const hero = layout.hero;
    const heroRect = hero ? { left: hero.left - input.scrollX, top: hero.top - input.scrollY, bottom: hero.top + hero.height - input.scrollY } : null;
    const heroLeft = heroRect ? heroRect.left : 0;
    const heroTop = heroRect ? heroRect.top : 0;
    const heroVisible = heroRect && heroRect.bottom > 0 && heroRect.top < vh && heroContentOpacity > .001;

    // The canvas is fixed to the viewport; carry text with its hero on scroll,
    // including particles currently displaced by the pointer or intro.
    const textShiftX = heroLeft - textOriginX;
    const textShiftY = heroTop - textOriginY;
    if (heroVisible) {
      if (textShiftX || textShiftY) for (const p of activeTextParticles) {
        p.x += textShiftX;
        p.y += textShiftY;
      }
      textOriginX = heroLeft;
      textOriginY = heroTop;
    }

    const introElapsed = introStart ? now - introStart : INTRO_DURATION;
    if (introStart) {
      if (introElapsed >= INTRO_DURATION) {
        introStart = 0;
        settleHeroText(heroLeft, heroTop);
      }
    } else {
      if (hero && !solidified) {
        settleHeroText(heroLeft, heroTop);
      }
    }
    const isSolidified = solidified;

    if (!isSolidified) {
      while (introCursor < introQueue.length && introQueue[introCursor].delay <= introElapsed) {
        activeTextParticles.add(introQueue[introCursor++]);
      }
    }

    const pointerOnHero = heroVisible && !paused && !heroDeparture && mouseX > -1000;
    const workingText = !heroVisible ? [] : !isSolidified ? activeTextParticles
      : pointerOnHero ? particleGrid.near(mouseX - heroLeft, mouseY - heroTop, 82, activeTextParticles)
        : activeTextParticles;

    // 1. Persistent sky: still stars, slow drift, and occasional local motion.
    const starMovingSpeed = Math.hypot(starVx, starVy);
    for (const s of renderStars) {
      if (!paused) {
        s.p += s.wanderSpeed * frameStep;
        const targetWanderX = s.origX + (Math.cos(s.p) + Math.sin(s.p * 1.73) * 0.3) * s.wanderRadiusX;
        const targetWanderY = s.origY + Math.sin(s.p * 0.82 + s.depth) * s.wanderRadiusY;
        s.vx += (targetWanderX - s.x) * 0.008 * frameStep;
        s.vy += (targetWanderY - s.y) * 0.008 * frameStep;
      }

      // Only nearby stars feel the passing companion, with no continuous
      // repulsion once it rests beside the title.
      const sDx = s.x - starX, sDy = s.y - starY;
      const sDist = Math.hypot(sDx, sDy);
      const miraRepelDist = 135;
      if (!paused && starMovingSpeed > 0.15 && sDist < miraRepelDist && sDist > 1) {
        const f = Math.pow(1 - sDist / miraRepelDist, 1.6);
        const push = f * Math.min(starMovingSpeed, 8) * 0.025;
        s.vx += ((sDx - sDy * 0.3) / sDist) * push * frameStep;
        s.vy += ((sDy + sDx * 0.3) / sDist) * push * frameStep;
        s.glow = Math.min(0.35, s.glow + f * 0.025 * frameStep);
      }

      // Cursor perturbation
      if (!paused && mouseX > -1000) {
        const mDx = s.x - mouseX, mDy = s.y - mouseY;
        const mDist = Math.hypot(mDx, mDy);
        if (mDist < 120 && mDist > 1) {
          const mf = Math.pow(1 - mDist / 120, 1.5);
          s.vx += ((mDx / mDist) * mf * 0.12 + mouseVx * mf * 0.008) * frameStep;
          s.vy += ((mDy / mDist) * mf * 0.12 + mouseVy * mf * 0.008) * frameStep;
          s.glow = Math.min(0.35, s.glow + mf * 0.015 * frameStep);
        }
      }

      if (!paused) {
        const damping = Math.pow(0.9, frameStep);
        s.vx *= damping; s.vy *= damping;
        s.x += s.vx * frameStep; s.y += s.vy * frameStep;
        s.glow *= Math.pow(0.96, frameStep);
      }

      // Recruited stars are drawn once, by their moving glyph particle.
      if (hero && s.textParticle) continue;
      const breathWave = paused ? 0 : Math.sin(now / s.breathPeriod * Math.PI * 2 + s.breathPhase) * .72
        + Math.sin(now / s.breathPeriod * Math.PI * 3.4 + s.breathPhase * 1.7) * .28;
      const breath = 1 + breathWave * s.breathAmount;
      const twinkle = paused ? 1 : (0.88 + 0.12 * Math.sin(now / (2600 + s.depth * 3100) + s.p)) * breath + s.glow * 0.3;
      const alpha = clamp(s.o * twinkle, 0, 1);
      particlePainter.dot(s.x + pointerX * (.05 + s.depth * .1), s.y + pointerY * (.05 + s.depth * .1), s.r * breath * (1 + s.glow * .35), s.isGold ? 238 : 176, s.isGold ? 215 : 202, s.isGold ? 172 : 230, alpha);

      if (s.glow > 0.35 || (s.depth > 0.90 && alpha > 0.6)) {
        particlePainter.dot(s.x, s.y, s.r * .45, 255, 252, 240, clamp(alpha * .95, 0, 1));
      }
    }

    paintCometTrail(now);

    // Dust shares the trail's document coordinates, so scrolling cannot drag
    // already emitted particles along with the viewport.
    if (!paused && cometMovingSpeed > 0.6) {
      const travelling = !introStart && cometHasDeparted;
      cometSparkBudget += Math.min(3, Math.floor(cometMovingSpeed / Math.max(frameStep, .01) * .55) + 1) * quality.dust * frameStep;
      const sparkCount = Math.floor(cometSparkBudget);
      cometSparkBudget -= sparkCount;
      for (let k = 0; k < sparkCount; k++) {
        const spAngle = Math.random() * Math.PI * 2;
        const spDist = Math.random() * (travelling ? 5 : 22);
        const alongWake = travelling ? (k + Math.random()) / sparkCount : 0;
        stardustSparks.push({
          x: cometWorld.x - cometVx * alongWake + Math.cos(spAngle) * spDist,
          y: cometWorld.y - cometVy * alongWake + Math.sin(spAngle) * spDist,
          world: true,
          vx: -cometVx * (travelling ? .06 : .25) + (Math.random() - 0.5) * (travelling ? .8 : 2.2),
          vy: -cometVy * (travelling ? .06 : .25) + (Math.random() - 0.5) * (travelling ? .8 : 2.2),
          size: travelling ? .45 + Math.random() * .8 : .8 + Math.random() * 1.3,
          life: 1.0,
          decay: travelling ? .006 + Math.random() * .006 : .022 + Math.random() * .022,
          rgb: VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)]
        });
      }
    }

    // 2. Staggered gathering, then direct interaction with the settled text.
    let dislodgedCount = 0;

    if (heroVisible) {
      for (const p of workingText) {
        const homeX = heroLeft + p.relX;
        const homeY = heroTop + p.relY;
        if (p.settled || paused || (isSolidified && !p.dislodged)) {
          p.x = homeX; p.y = homeY;
          if (isSolidified) {
            p.settled = true; p.dislodged = false; p.dislodgedFactor = 0;
            p.vx = p.vy = p.glow = 0;
          }
        }
        const toHomeX = homeX - p.x;
        const toHomeY = homeY - p.y;
        const distToHome = Math.hypot(toHomeX, toHomeY);

        if (!isSolidified) {
          const progress = clamp((introElapsed - p.delay) / p.travelDuration, 0, 1);
          const u = smoothstep(progress);
          p.introProgress = progress;
          const fromX = heroLeft + p.startRelX;
          const fromY = heroTop + p.startRelY;
          const arc = p.bend ? Math.sin(Math.PI * u) : 0;
          const drift = p.sourceStar ? Math.sin(introElapsed / 1500 + p.sourceStar.p) * 1.2 * (1 - u) : 0;
          p.x = fromX + p.travelX * u + p.arcX * arc + drift;
          p.y = fromY + p.travelY * u + p.arcY * arc + drift * 0.5;
          p.vx = 0; p.vy = 0;
          p.glow = 0;
          p.settled = progress === 1;
        } else {
          // Solidified state: direct particle interaction and local disintegration
          let mDist = 9999;
          if (pointerOnHero) {
            const mDx = p.x - mouseX;
            const mDy = p.y - mouseY;
            mDist = Math.hypot(mDx, mDy);
            const repelRadius = 82;
            if (mDist < repelRadius && mDist > 0.5) {
              const mF = 1 - mDist / repelRadius;
              p.dislodged = true;
              if (p.glyphLayer) p.glyphLayer.active = true;
              p.settled = false;
              p.dislodgedFactor = Math.min(1.0, p.dislodgedFactor + 0.32 * frameStep);
              const push = mF * 11.5 + Math.hypot(mouseVx, mouseVy) * 0.22;
              const swirl = mF * 7.0 * p.swirlDir;
              p.vx += ((mDx / mDist) * push + (-mDy / mDist) * swirl + mouseVx * 0.24) * frameStep;
              p.vy += ((mDy / mDist) * push + (mDx / mDist) * swirl + mouseVy * 0.24) * frameStep;
              p.glow = Math.min(1.0, p.glow + mF * 1.2);
            }
          }

          if (!p.settled) {
            const speed = Math.hypot(p.vx, p.vy);
            // Settle cleanly into exact pixel coordinate
            if (distToHome < 1.4 && (speed < 0.7 || distToHome < 0.7) && mDist > 84) {
              p.x = homeX; p.y = homeY;
              p.vx = 0; p.vy = 0;
              p.settled = true;
              p.dislodged = false;
              p.dislodgedFactor = 0;
              p.glow = 0;
            } else {
              // Cosmic gravity pulling back into letterform
              const pull = Math.min(distToHome * 0.098, 9.2);
              const swirlDistFactor = clamp((distToHome - 8) / 28, 0, 1);
              const swirl = Math.min(distToHome * 0.024, 2.5) * p.swirlDir * swirlDistFactor;
              if (distToHome > 0.3) {
                p.vx += ((toHomeX / distToHome) * pull + (-toHomeY / distToHome) * swirl) * frameStep;
                p.vy += ((toHomeY / distToHome) * pull + (toHomeX / distToHome) * swirl) * frameStep;
              }
              const damp = distToHome < 12 ? 0.70 : 0.82;
              p.vx *= Math.pow(damp, frameStep); p.vy *= Math.pow(damp, frameStep);
              p.x += p.vx * frameStep; p.y += p.vy * frameStep;
              p.glow *= Math.pow(.91, frameStep);
              if (mDist > 84) {
                p.dislodgedFactor = Math.max(0, p.dislodgedFactor - 0.04 * frameStep);
              }
            }
          }
        }

        const arrival = introStart ? smoothstep((p.introProgress - .72) / .28) : 1;
        const glyphDistance = p.settled ? 0 : Math.hypot(p.x - homeX, p.y - homeY);
        setGlyphCoverage(p, arrival * (1 - smoothstep((glyphDistance - 1) / 9)));
        if (!p.settled) {
          dislodgedCount++;
          activeTextParticles.add(p);
        }
      }
    }

    if (heroVisible) {
      updateGlyphLayers(heroLeft, heroTop, frameStep, now);
      renderer.glyphs(glyphLayers, heroLeft, heroTop, heroContentOpacity);
    }

    // 3. A sparse travelling star becomes a glyph; nearby detail fades in only
    // as it arrives, keeping empty space clear during the opening.
    if (heroVisible) {
      for (const p of workingText) {
        p.glyphBlend = sampleGlyphCoverage(p);
        if (p.settled && p.glyphBlend >= .998) {
          activeTextParticles.delete(p);
          continue;
        }
        const reveal = introStart ? smoothstep(p.introProgress) : 1;
        const arrival = introStart ? smoothstep((p.introProgress - 0.55) / 0.45) : 1;
        let alpha = p.targetAlpha;
        if (introStart) {
          if (p.sourceStar) {
            const s = p.sourceStar;
            const twinkle = 0.86 + 0.14 * Math.sin(now / (2600 + s.depth * 3100) + s.p);
            alpha = s.o * twinkle * (1 - arrival) + p.targetAlpha * arrival;
          } else {
            alpha *= reveal;
          }
        } else if (p.dislodged) {
          alpha = clamp(alpha + p.glow * 0.35, 0, 1);
        }
        if (p.glyphCell) alpha *= 1 - p.glyphBlend;
        alpha *= heroContentOpacity;
        if (alpha <= 0.01) continue;
        const grainDetail = introStart ? quality.grain * (.65 + (1 - arrival) * .35)
          : p.dislodged ? quality.grain * .45 : 0;

        let red, green, blue;
        if (isSolidified) {
          const f = p.dislodgedFactor;
          red = p.targetColorRgb[0] + (p.vanGoghRgb[0] - p.targetColorRgb[0]) * f;
          green = p.targetColorRgb[1] + (p.vanGoghRgb[1] - p.targetColorRgb[1]) * f;
          blue = p.targetColorRgb[2] + (p.vanGoghRgb[2] - p.targetColorRgb[2]) * f;
        } else {
          const f = 1 - arrival;
          const starRgb = p.sourceStar?.isGold ? [238, 215, 172] : [176, 202, 230];
          red = p.targetColorRgb[0] + (starRgb[0] - p.targetColorRgb[0]) * f;
          green = p.targetColorRgb[1] + (starRgb[1] - p.targetColorRgb[1]) * f;
          blue = p.targetColorRgb[2] + (starRgb[2] - p.targetColorRgb[2]) * f;
        }

        // Settled small text retains its dense glyph sampling.
        if (p.settled && p.isSmall) {
          // High-definition subpixel rasterization: 100% crisp typography
          particlePainter.dot(p.x, p.y, -.55, red, green, blue, alpha, grainDetail, p.detailRank);
        } else {
          const startRadius = p.sourceStar ? p.sourceStar.r : p.radius * 0.65;
          const renderRadius = (introStart ? startRadius + (p.radius - startRadius) * arrival : p.radius) * (1 + p.glow * 0.35);

          particlePainter.dot(p.x, p.y, renderRadius, red, green, blue, alpha, grainDetail, p.detailRank);

          if (p.glow > 0.25 || p.vx * p.vx + p.vy * p.vy > 1.44) {
            particlePainter.dot(p.x, p.y, Math.max(.4, renderRadius * .45), 255, 252, 242, alpha * .85);
          }
        }
      }
    }

    // 4. Stardust emission & rendering on disintegration
    if (!paused && isSolidified && dislodgedCount > 0) {
      const mSpeed = Math.hypot(mouseVx, mouseVy);
      if (mSpeed > 0.6) {
        textSparkBudget += Math.min(2, Math.floor(mSpeed * .5) + 1) * quality.dust * frameStep;
        const count = Math.floor(textSparkBudget);
        textSparkBudget -= count;
        for (let k = 0; k < count; k++) {
          const spA = Math.random() * Math.PI * 2;
          const spD = Math.random() * 55;
          const spRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
          stardustSparks.push({
            x: mouseX + Math.cos(spA) * spD,
            y: mouseY + Math.sin(spA) * spD,
            vx: mouseVx * 0.2 + (Math.random() - 0.5) * 2.5 + (-Math.sin(spA) * 2),
            vy: mouseVy * 0.2 + (Math.random() - 0.5) * 2.5 + (Math.cos(spA) * 2),
            size: 0.6 + Math.random() * 0.8,
            life: 1.0,
            decay: 0.035 + Math.random() * 0.025,
            rgb: spRgb
          });
        }
      }
    }

    if (stardustSparks.length > 0) {
      let kept = 0;
      for (const sp of stardustSparks) {
        if (!paused) {
          sp.x += sp.vx * frameStep; sp.y += sp.vy * frameStep;
          const damping = Math.pow(.91, frameStep);
          sp.vx *= damping; sp.vy *= damping;
          sp.life -= sp.decay * frameStep;
        }
        const turnOpacity = sp.turnFadeAt === undefined ? 1 : cometTurnOpacity(sp.turnFadeAt, now);
        if (sp.life <= 0 || turnOpacity <= 0) continue;
        stardustSparks[kept++] = sp;
        const x = sp.x - (sp.world ? input.scrollX : 0), y = sp.y - (sp.world ? input.scrollY : 0);
        if (x < -3 || x > vw + 3 || y < -3 || y > vh + 3) continue;
        particlePainter.dot(x, y, sp.size * (.5 + sp.life * .5), sp.rgb[0], sp.rgb[1], sp.rgb[2], clamp(sp.life * .9, 0, 1) * turnOpacity);
      }
      stardustSparks.length = kept;
    }
    renderer.flush();
    if (!paused) {
      mouseVx *= Math.pow(0.86, frameStep);
      mouseVy *= Math.pow(0.86, frameStep);
    }

  }


  function paintCometTrail(now) {
    fadeCometTrail(cometTrail, now, !paused && !introStart && cometHasDeparted);
    for (const segment of visibleCometTrailSegments(cometTrail)) {
      const feather = Math.max(1, Math.min(cometTrail.maxLength * .3, (segment.distance - segment.rear) * .65));
      const opening = segment.points.filter(p => p.param <= cometPath.heroLength);
      if (opening.length > 1) {
        const a = cometPoint(cometPath, opening[0].param).u, b = cometPoint(cometPath, opening.at(-1).param).u;
        const end = opening.find(p => p.distance >= segment.rear + feather) || opening.at(-1);
        const fade = Math.abs(cometPoint(cometPath, end.param).u - a);
        renderer.opening(input.scrollX, input.scrollY, Math.min(a, b), Math.max(a, b), fade, segment.opacity);
      }
      renderer.wake(wakeMesh(segment.points, segment.distance, cometTrail.maxLength, cometPath.heroLength),
        input.scrollX, input.scrollY, segment.rear, segment.distance, feather, segment.opacity);
    }
  }
  function replay(start) {
    introStart = start; solidified = false; introCursor = 0;
    activeTextParticles = new Set(textParticles.filter(p => p.sourceStar));
    cometTrail = createCometTrail(Math.hypot(vw, vh) * .82);
    cometParam = null; lastGlyphUpdate = 0; stardustSparks = [];
    for (const layer of glyphLayers) {
      layer.cells.forEach(c => { c.sum = c.alpha = 0; });
      layer.needsPaint = layer.active = true;
    }
    for (const p of textParticles) {
      p.x = textOriginX + p.startRelX; p.y = textOriginY + p.startRelY;
      p.coverage = p.glow = p.introProgress = p.vx = p.vy = p.dislodgedFactor = 0;
      p.settled = p.dislodged = false;
    }
  }
  return {
    draw(now, state, dpr) {
      input = state; paused = state.paused; heroDeparture = Boolean(state.departure);
      if (state.replay !== replaySequence) {
        replaySequence = state.replay;
        if (state.introEpoch && !paused) replay(state.introEpoch - performance.timeOrigin);
        else { introStart = 0; solidified = false; }
      }
      if ((!state.introEpoch || paused) && introStart) { introStart = 0; solidified = false; }
      if (state.pointer.sequence !== pointerSequence) {
        pointerSequence = state.pointer.sequence;
        ({ x: mouseX, y: mouseY, vx: mouseVx, vy: mouseVy } = state.pointer);
      }
      pointerX = mouseX > -1000 ? (mouseX / vw - .5) * 16 : 0;
      pointerY = mouseY > -1000 ? (mouseY / vh - .5) * 12 : 0;
      const oldParam = cometParam;
      cometPath = state.path || layout.path;
      cometParam = state.param;
      if (introStart) cometParam = cometPath.heroLength * smoothstep((now - introStart - 200) / 3300);
      cometWorld = cometPoint(cometPath, cometParam);
      starX = cometWorld.x - state.scrollX; starY = cometWorld.y - state.scrollY;
      const from = oldParam === null ? (state.introEpoch || cometWorld.docking === 1 ? cometParam : Math.max(0, cometParam - cometTrail.maxLength)) : oldParam;
      if (recordCometMotion(cometTrail, cometPath, from, cometParam, now)) for (const sp of stardustSparks) if (sp.world) sp.turnFadeAt ??= now;
      cometHasDeparted = state.scrollY > 0;
      heroContentOpacity = state.heroOpacity;
      renderer.begin(vw, vh, dpr);
      paintParticlesAndStars(now);
      frameCount++;
    },
    get stats() { return { frameCount, particles: textParticles.length, active: activeTextParticles.size, glyphs: glyphLayers.length, solidified, maskPixels: glyphLayers.reduce((n, l) => n + l.cells.length, 0) }; },
    destroy() { glyphLayers.forEach(layer => renderer.deleteGlyph(layer)); }
  };
}
